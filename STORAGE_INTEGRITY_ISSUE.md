# Critical Storage Integrity Issue

## Problem Statement

**Database has `file_url` entries pointing to Supabase Storage, but the actual storage bucket is empty.**

This means:
- ✅ Database records exist with valid `file_url` values
- ❌ Supabase Storage bucket `meal-plans` is empty (no files)
- ❌ PDFs cannot be accessed even though URLs exist

---

## Root Cause Analysis

### Possible Scenarios

#### Scenario 1: Upload Process Failed Midway ⚠️ **MOST LIKELY**
**What happens:**
1. Frontend uploads file → `/api/meal-plans/upload`
2. Upload succeeds → Returns `fileUrl` to frontend
3. Frontend calls `/api/meal-plans` → Creates database record with `fileUrl`
4. **BUT**: Storage upload actually failed or was rolled back
5. Database record persists with invalid URL

**Evidence to check:**
- Server logs showing upload errors
- Network requests showing 200 OK but file not actually stored
- Race condition between upload and database insert

#### Scenario 2: Files Were Deleted
**What happens:**
1. Files were successfully uploaded
2. Storage bucket had files
3. Files were deleted (manually, via API, or lifecycle policy)
4. Database records still reference deleted files

**Evidence to check:**
- Supabase Storage logs showing delete operations
- Storage bucket lifecycle policies
- Manual deletions in Supabase Dashboard

#### Scenario 3: Storage Bucket Configuration Issue
**What happens:**
1. Files uploaded to wrong bucket
2. Files uploaded to different Supabase project
3. Bucket permissions prevent file access
4. RLS policies blocking file visibility

**Evidence to check:**
- Multiple Supabase projects
- Bucket name mismatch
- RLS policy configuration

#### Scenario 4: Transaction Rollback Issue
**What happens:**
1. Upload succeeds → File in storage
2. Database insert fails → Transaction rolls back
3. **BUT**: Storage file deletion in cleanup fails
4. File remains in storage but database has no record
5. OR: Database record created but storage cleanup deletes file

**Evidence to check:**
- Code review of cleanup logic
- Error logs during meal plan creation
- Storage cleanup being called incorrectly

---

## Code Flow Analysis

### Current Upload Flow

**File**: `app/api/meal-plans/upload/route.ts`

```typescript
// Step 1: Upload to storage
const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
  .from("meal-plans")
  .upload(fileName, buffer, {
    contentType: "application/pdf",
    upsert: false,
  });

if (uploadError) {
  return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
}

// Step 2: Get public URL
const { data: urlData } = supabaseAdmin.storage
  .from("meal-plans")
  .getPublicUrl(fileName);

// Step 3: Return URL to frontend
return NextResponse.json({
  fileUrl: urlData.publicUrl,  // ⚠️ URL generated even if upload failed silently
  fileName: file.name,
  storagePath: fileName,
});
```

**Potential Issue**: `getPublicUrl()` generates a URL even if the file doesn't exist. The URL is valid, but the file might not be in storage.

### Current Meal Plan Creation Flow

**File**: `app/api/meal-plans/route.ts`

```typescript
// Step 1: Create meal plan record
const { data: mealPlan, error } = await supabaseAdmin
  .from("meal_plans")
  .insert({
    file_url: fileUrl,  // ⚠️ URL from upload endpoint
    // ... other fields
  });

// Step 2: Approve session request
if (sessionRequestId && mealPlan.file_url) {
  await supabaseAdmin
    .from("session_requests")
    .update({ status: "APPROVED" })
    .eq("id", sessionRequestId);
}
```

**Potential Issue**: No validation that `fileUrl` actually points to an existing file in storage.

### Cleanup Logic

**File**: `app/api/meal-plans/route.ts` (lines 96-105)

```typescript
const cleanupStorage = async () => {
  if (storagePath) {
    const { error: removeError } = await supabaseAdmin.storage
      .from("meal-plans")
      .remove([storagePath]);
    // ⚠️ Cleanup only called on error, but what if cleanup itself fails?
  }
};
```

**Potential Issue**: 
- Cleanup only runs on error
- If cleanup fails, file remains in storage but database record might be missing
- No verification that file exists before cleanup

---

## Diagnostic Queries

### 1. Check Database URLs

```sql
-- Get all meal plans with file URLs
SELECT 
  id,
  session_request_id,
  file_url,
  file_name,
  status,
  created_at,
  -- Extract storage path from URL
  CASE 
    WHEN file_url LIKE '%/meal-plans/%' THEN 
      SUBSTRING(file_url FROM '%/meal-plans/(.*)%')
    ELSE NULL
  END as storage_path
FROM meal_plans
WHERE file_url IS NOT NULL
ORDER BY created_at DESC;
```

### 2. Check Storage Bucket Contents

```typescript
// Use Supabase Storage API
const { data: files, error } = await supabaseAdmin.storage
  .from("meal-plans")
  .list("", { limit: 1000, sortBy: { column: "created_at", order: "desc" } });
```

### 3. Verify File Existence

```typescript
// For each file_url in database, check if file exists
const storagePath = extractPathFromUrl(fileUrl);
const { data: file, error } = await supabaseAdmin.storage
  .from("meal-plans")
  .list(storagePath, { limit: 1 });
```

---

## Immediate Fixes Needed

### Fix 1: Verify File Exists Before Creating Database Record

**File**: `app/api/meal-plans/route.ts`

```typescript
// Before creating meal plan, verify file exists in storage
const storagePath = extractStoragePathFromUrl(fileUrl);
const { data: files, error: listError } = await supabaseAdmin.storage
  .from("meal-plans")
  .list(storagePath, { limit: 1 });

if (listError || !files || files.length === 0) {
  console.error("[MEAL PLAN CREATE] File does not exist in storage:", {
    fileUrl,
    storagePath,
    error: listError,
  });
  return NextResponse.json(
    { 
      error: "File not found in storage", 
      details: "The uploaded file does not exist. Please re-upload the PDF." 
    },
    { status: 404 }
  );
}
```

### Fix 2: Add File Verification to Upload Endpoint

**File**: `app/api/meal-plans/upload/route.ts`

```typescript
// After upload, verify file actually exists
const { data: verifyFiles, error: verifyError } = await supabaseAdmin.storage
  .from("meal-plans")
  .list(fileName, { limit: 1 });

if (verifyError || !verifyFiles || verifyFiles.length === 0) {
  console.error("[UPLOAD] Upload reported success but file not found:", {
    fileName,
    uploadData,
    verifyError,
  });
  return NextResponse.json(
    { 
      error: "Upload verification failed", 
      details: "File was uploaded but could not be verified. Please try again." 
    },
    { status: 500 }
  );
}
```

### Fix 3: Add Storage Integrity Check Endpoint

Create a diagnostic endpoint to check storage integrity:

**File**: `app/api/debug/storage-integrity/route.ts`

```typescript
// Check all meal plans and verify files exist in storage
const { data: mealPlans } = await supabaseAdmin
  .from("meal_plans")
  .select("id, file_url, storage_path")
  .not("file_url", "is", null);

const results = await Promise.all(
  mealPlans.map(async (plan) => {
    const storagePath = extractStoragePathFromUrl(plan.file_url);
    const { data: files } = await supabaseAdmin.storage
      .from("meal-plans")
      .list(storagePath, { limit: 1 });
    
    return {
      mealPlanId: plan.id,
      fileUrl: plan.file_url,
      storagePath,
      fileExists: files && files.length > 0,
    };
  })
);
```

---

## Long-term Solutions

### 1. Add Database Constraint
Add a trigger to verify file exists before allowing meal plan creation:

```sql
CREATE OR REPLACE FUNCTION verify_storage_file()
RETURNS TRIGGER AS $$
BEGIN
  -- This would require a storage check function
  -- Supabase doesn't support this directly, so use application-level validation
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 2. Implement Transaction Pattern
Wrap storage upload + database insert in a transaction-like pattern:

```typescript
try {
  // 1. Upload file
  const uploadResult = await uploadFile();
  
  // 2. Verify file exists
  await verifyFileExists(uploadResult.path);
  
  // 3. Create database record
  const mealPlan = await createMealPlan(uploadResult.url);
  
  // 4. If database insert fails, cleanup storage
  return mealPlan;
} catch (error) {
  // Rollback: Delete file from storage
  await cleanupStorage(uploadResult.path);
  throw error;
}
```

### 3. Add Monitoring
- Log all storage operations
- Alert when file_url exists but file doesn't
- Track storage upload success/failure rates

### 4. Data Cleanup Script
Create a script to:
- Find all meal plans with invalid file URLs
- Mark them as "FILE_MISSING" status
- Notify dietitians to re-upload

---

## Action Items

### Immediate (Critical)
1. ✅ Create diagnostic endpoint to check storage integrity
2. ⏳ Add file verification before creating meal plan records
3. ⏳ Add file verification after upload
4. ⏳ Check server logs for upload errors

### Short-term (High Priority)
1. Add storage integrity check to meal plan creation
2. Implement proper error handling and rollback
3. Add monitoring/alerting for storage issues
4. Document storage bucket configuration

### Long-term (Important)
1. Implement transaction pattern for upload + database insert
2. Add automated storage integrity checks
3. Create data cleanup process for orphaned records
4. Add storage lifecycle management

---

## Testing Checklist

- [ ] Verify storage bucket exists and is accessible
- [ ] Test upload endpoint and verify file appears in storage
- [ ] Test meal plan creation and verify file still exists
- [ ] Test error scenarios (upload fails, database insert fails)
- [ ] Run diagnostic endpoint to check existing records
- [ ] Verify cleanup logic works correctly
- [ ] Check RLS policies don't block file access

---

*Generated: 2025-01-16*
*Issue: Storage bucket empty but database has file_url entries*


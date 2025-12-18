# Storage Integrity Issue - Fix Summary

## Issue Identified

**Critical Problem**: Database has `file_url` entries pointing to Supabase Storage, but the storage bucket is empty. This means meal plans show as "sent" but PDFs cannot be accessed.

## Root Cause

The most likely scenario is that:
1. Upload endpoint returns a URL even if upload fails silently
2. Database record is created with the URL
3. File never actually exists in storage
4. No verification step to ensure file exists before creating database record

## Fixes Applied

### ✅ Fix 1: File Verification Before Database Insert

**File**: `app/api/meal-plans/route.ts`

**What it does**:
- Before creating meal plan record, verifies file actually exists in storage
- Extracts storage path from URL
- Lists files in storage directory to confirm file exists
- Returns error if file not found (prevents orphaned database records)

**Code Added** (lines ~193-240):
```typescript
// ⚠️ CRITICAL: Verify file exists in storage before creating database record
if (storagePath) {
  const { data: files, error: listError } = await supabaseAdmin.storage
    .from("meal-plans")
    .list(directory || "", { limit: 1000 });

  const fileExists = files?.some((f: any) => f.name === filename);
  if (!fileExists) {
    return NextResponse.json(
      { 
        error: "File not found in storage", 
        details: "The uploaded file does not exist in storage. Please re-upload the PDF." 
      },
      { status: 404 }
    );
  }
}
```

### ✅ Fix 2: Storage Integrity Diagnostic Endpoint

**File**: `app/api/debug/storage-integrity/route.ts` (NEW)

**What it does**:
- Checks all meal plans with file URLs
- Verifies each file exists in storage
- Reports missing files, invalid URLs, and storage bucket status
- Provides summary statistics

**Usage**:
```bash
GET /api/debug/storage-integrity
```

**Response**:
```json
{
  "success": true,
  "summary": {
    "totalMealPlans": 10,
    "totalFilesInStorage": 5,
    "filesExist": 5,
    "filesMissing": 5,
    "invalidUrls": 0
  },
  "integrityChecks": [...],
  "issues": {
    "missingFiles": [...],
    "invalidUrls": [...]
  }
}
```

## Testing the Fix

### 1. Test File Verification
```bash
# Try to create a meal plan with invalid file URL
curl -X POST http://localhost:3000/api/meal-plans \
  -H "Content-Type: application/json" \
  -d '{
    "sessionRequestId": "...",
    "userId": "...",
    "packageName": "Test",
    "fileUrl": "https://invalid-url.com/file.pdf",
    "storagePath": "invalid/path"
  }'
# Should return 404 error: "File not found in storage"
```

### 2. Check Storage Integrity
```bash
# Run diagnostic endpoint
curl http://localhost:3000/api/debug/storage-integrity
# Review the response for missing files
```

### 3. Test Normal Flow
1. Upload PDF → Should succeed
2. Create meal plan → Should verify file exists first
3. Check database → Record should only exist if file verified

## Next Steps

### Immediate Actions
1. ✅ File verification added to meal plan creation
2. ✅ Diagnostic endpoint created
3. ⏳ **Run diagnostic endpoint** to identify existing orphaned records
4. ⏳ **Fix orphaned records** (either re-upload files or mark as missing)

### Short-term Actions
1. Add file verification to upload endpoint (verify after upload)
2. Add monitoring/alerting for storage integrity issues
3. Create data cleanup script for orphaned records
4. Document storage bucket configuration requirements

### Long-term Actions
1. Implement transaction pattern for upload + database insert
2. Add automated storage integrity checks (cron job)
3. Add storage lifecycle management
4. Create admin UI for storage management

## How to Use Diagnostic Endpoint

### In Browser
Navigate to: `http://localhost:3000/api/debug/storage-integrity`

### Via cURL
```bash
curl http://localhost:3000/api/debug/storage-integrity
```

### What to Look For
- **`filesMissing`**: Meal plans with URLs but no files in storage
- **`invalidUrls`**: Meal plans with malformed URLs
- **`totalFilesInStorage`**: Actual count of files in bucket
- **`totalMealPlans`**: Count of meal plans with file URLs

## Handling Orphaned Records

If diagnostic endpoint finds missing files:

### Option 1: Mark as Missing
```sql
UPDATE meal_plans
SET status = 'FILE_MISSING'
WHERE id IN (
  -- IDs from diagnostic endpoint
);
```

### Option 2: Delete Orphaned Records
```sql
DELETE FROM meal_plans
WHERE id IN (
  -- IDs from diagnostic endpoint
);
```

### Option 3: Re-upload Files
- Contact dietitians to re-upload PDFs
- Use the upload flow to create new records

## Prevention

The fix ensures:
1. ✅ Files are verified before database records are created
2. ✅ Invalid file URLs are caught early
3. ✅ Storage integrity can be monitored via diagnostic endpoint
4. ✅ Future meal plans won't have this issue

---

*Generated: 2025-01-16*
*Status: Fixes applied, ready for testing*


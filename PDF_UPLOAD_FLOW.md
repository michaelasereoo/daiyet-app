# PDF Upload Flow - Complete Code Reference

## Flow Overview

1. **Upload PDF** → File is uploaded to Supabase Storage
2. **Show Preview** → PDF filename is displayed
3. **Click "Send"** → Meal plan is created and request is approved
4. **View Status** → Shows "Sent" with checkmark
5. **View PDF** → Button appears in approved section

---

## Key Files and Code Locations

### 1. Frontend: Upload Handler
**File:** `app/dashboard/session-request/SessionRequestClient.tsx`

**Lines 47-129:** `handleUploadPdf` function
- Opens file picker
- Uploads PDF to `/api/meal-plans/upload`
- Stores file info in `uploadedFiles` state (doesn't send yet)

**Lines 131-236:** `handleSendMealPlan` function
- Gets user ID from email
- Creates meal plan via `/api/meal-plans`
- Removes file from `uploadedFiles` state after sending

**State Management:**
```typescript
const [uploadedFiles, setUploadedFiles] = useState<Record<string, { fileUrl: string; fileName: string }>>({});
const [isSending, setIsSending] = useState<Record<string, boolean>>({});
```

---

### 2. Frontend: UI Display
**File:** `components/session-request/SessionRequestList.tsx`

**Lines 200-240:** Pending request actions
- Shows "Upload PDF" button if no file uploaded
- Shows PDF filename preview + "Send" button if file uploaded
- Shows "Sending..." state while processing

**Lines 213-236:** Approved request display
- Shows "Sent" status with checkmark
- Shows "View PDF" button that opens PDF in new tab

---

### 3. Backend: File Upload API
**File:** `app/api/meal-plans/upload/route.ts`

**Key Functions:**
- Validates file type (PDF only)
- Validates file size (max 10MB)
- Uploads to Supabase Storage bucket `meal-plans`
- Returns public URL and filename

**Storage Path Format:**
```
{dietitianId}/{timestamp}-{sanitizedFileName}
```

**Returns:**
```json
{
  "fileUrl": "https://...supabase.co/storage/v1/object/public/meal-plans/...",
  "fileName": "original-filename.pdf",
  "storagePath": "uuid/timestamp-filename.pdf"
}
```

---

### 4. Backend: Meal Plan Creation API
**File:** `app/api/meal-plans/route.ts`

**Lines 78-281:** POST handler
- Validates userId (must be UUID)
- Creates record in `meal_plans` table
- Links to `session_request_id`
- Updates `session_requests` status to "APPROVED" if PDF URL is valid

**Database Insert:**
```typescript
{
  session_request_id: sessionRequestId,
  dietitian_id: dietitianId,
  user_id: userId,
  package_name: packageName,
  file_url: fileUrl,
  file_name: fileName,
  status: "SENT",
  sent_at: new Date().toISOString(),
}
```

---

## How to View/Test the Flow

### 1. **View the Upload UI**
Navigate to: `http://localhost:3000/dashboard/session-request`

**Pending Requests Section:**
- Click "Upload PDF" button
- Select a PDF file
- See filename preview appear
- Click "Send" button
- See "Sending..." state

### 2. **View After Sending**
**Approved Section:**
- Request moves to "Approved Meal Plans and Session Requests"
- Shows "Sent" status with green checkmark
- "View PDF" button opens PDF in new tab

### 3. **View in Browser Console**
Open DevTools Console to see:
- `"Starting PDF upload..."` - When upload starts
- `"Upload successful:"` - When file is uploaded
- `"PDF uploaded successfully. Ready to send."` - After upload
- `"Sending meal plan with:"` - When Send is clicked
- `"Meal plan sent successfully:"` - After meal plan is created

### 4. **View Server Logs**
Check terminal/server logs for:
- `[UPLOAD]` - Upload process logs
- `[MEAL PLAN CREATE]` - Meal plan creation logs
- `[SESSION REQUEST API]` - Session request fetch logs

### 5. **View Database**
Check Supabase:
- `meal_plans` table - Contains uploaded PDFs
- `session_requests` table - Status changes from PENDING → APPROVED

### 6. **View Storage**
Check Supabase Storage:
- Bucket: `meal-plans`
- Files organized by: `{dietitianId}/{timestamp}-{filename}.pdf`

---

## State Flow Diagram

```
PENDING Request
    ↓
[Click "Upload PDF"]
    ↓
File Uploaded → Stored in `uploadedFiles` state
    ↓
[Shows PDF filename + "Send" button]
    ↓
[Click "Send"]
    ↓
Meal Plan Created → `session_requests.status = "APPROVED"`
    ↓
Request Moves to Approved Section
    ↓
[Shows "Sent" + Checkmark + "View PDF" button]
```

---

## Key API Endpoints

1. **POST `/api/meal-plans/upload`**
   - Uploads PDF file
   - Returns: `{ fileUrl, fileName, storagePath }`

2. **POST `/api/users/by-email`**
   - Gets user UUID from email
   - Returns: `{ users: [{ id, email }] }`

3. **POST `/api/meal-plans`**
   - Creates meal plan record
   - Approves session request
   - Returns: `{ mealPlan: {...} }`

---

## Debug Tools

1. **Test Upload Page:** `http://localhost:3000/test-storage`
   - Test PDF upload directly
   - View file URL
   - Delete uploaded files

2. **Unapprove Tool:** `http://localhost:3000/test-upload-flow`
   - Unapprove all meal plan requests
   - Check upload flow state

3. **Debug Endpoint:** `GET /api/debug/upload-flow?requestId={id}`
   - Check meal plan linking
   - View upload state


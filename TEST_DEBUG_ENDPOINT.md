# Test Debug Endpoint for Dietitian

## Dietitian UUID
```
b900e502-71a6-45da-bde6-7b596cc14d88
```

## Debug Endpoint URL

### Local Development
```
http://localhost:3000/api/debug/timeslots?dietitianId=b900e502-71a6-45da-bde6-7b596cc14d88&date=2025-01-20
```

### Production
```
https://your-domain.com/api/debug/timeslots?dietitianId=b900e502-71a6-45da-bde6-7b596cc14d88&date=2025-01-20
```

## Test Different Dates

Replace `date=2025-01-20` with:
- Today: Current date in 2025
- Monday: `date=2025-01-20` (Jan 20, 2025 is a Monday)
- Tuesday: `date=2025-01-21`
- etc.

## Expected Response

```json
{
  "success": true,
  "dietitianId": "b900e502-71a6-45da-bde6-7b596cc14d88",
  "date": "2025-01-20",
  "dayOfWeek": 1,
  "dayName": "Monday",
  "hasDefaultSchedule": true,
  "defaultSchedule": {
    "id": "...",
    "name": "Working Hours",
    "isDefault": true,
    "active": true,
    "timezone": "Africa/Lagos"
  },
  "totalSlots": 5,
  "enabledSlots": 5,
  "todaySlots": 1,
  "todaySlotsData": [...],
  "bookingsCount": 0,
  "oooPeriodsCount": 0,
  "overridesCount": 0,
  "slotsByDay": {
    "Monday": { "total": 1, "enabled": 1 },
    "Tuesday": { "total": 1, "enabled": 1 },
    ...
  }
}
```

## What to Check

1. **hasDefaultSchedule**: Should be `true`
2. **defaultSchedule.active**: Should be `true` (if column exists)
3. **enabledSlots**: Should be > 0
4. **todaySlots**: Should be > 0 for days with availability
5. **slotsByDay**: Should show enabled slots for each day

## If Zero Slots Returned

Check:
- Is `hasDefaultSchedule` false? → No default schedule exists
- Is `enabledSlots` 0? → All slots are disabled
- Is `todaySlots` 0? → No slots configured for that day of week
- Check `slotsByDay` to see which days have slots

## Quick Test Commands

### Using curl
```bash
curl "http://localhost:3000/api/debug/timeslots?dietitianId=b900e502-71a6-45da-bde6-7b596cc14d88&date=2025-01-20" \
  -H "Cookie: your-auth-cookie"
```

### Using browser console
```javascript
fetch('/api/debug/timeslots?dietitianId=b900e502-71a6-45da-bde6-7b596cc14d88&date=2025-01-20', {
  credentials: 'include'
})
.then(r => r.json())
.then(console.log);
```


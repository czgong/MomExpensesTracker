# Month-Specific Percentage Verification Report

**Date**: December 29, 2025
**Status**: ✅ VERIFIED - Working as Expected

## Summary

Participant percentages are **correctly isolated per month**. Changing percentages for one month does NOT affect other months.

## How It Works

### Database Structure
- Table: `monthly_shares`
- Columns: `id`, `person_id`, `month_key`, `percentage_share`, `created_at`, `updated_at`, `locked`, `locked_at`, `locked_by`
- **Key constraint**: Each person can have different percentages for different months via the `month_key` field

### Frontend Implementation

#### 1. Loading Shares (when switching months)
**File**: `src/App.js:174-203`

```javascript
const loadMonthlyShares = async (monthKey, personsData) => {
  const response = await fetch(`${API_URL}/api/monthly-shares/${monthKey}`);
  // Returns shares specific to this month
}
```

- Fetches shares for the **specific month** being viewed
- If no shares exist, inherits from latest month
- Falls back to equal distribution if no data exists

#### 2. Saving Shares (when user edits percentages)
**File**: `src/App.js:206-231`

```javascript
const saveMonthlyShares = async (monthKey, participants) => {
  await fetch(`${API_URL}/api/monthly-shares`, {
    method: 'POST',
    body: JSON.stringify({
      monthKey: monthKey,  // ← Scoped to current month only
      shares: shares
    })
  });
}
```

- Saves changes **only to the active month** (`activeMonthTab`)
- Does not modify other months

#### 3. Month Switching
**File**: `src/App.js:836-845`

```javascript
useEffect(() => {
  if (activeMonthTab && persons.length > 0) {
    syncParticipantsWithPersons(persons, activeMonthTab, true); // Force reload
  }
}, [activeMonthTab, persons]);
```

- When user switches months, reloads participants with that month's percentages
- Ensures UI always shows correct percentages for the active month

### API Endpoints

#### GET `/api/monthly-shares/:monthKey`
Returns percentage shares for a specific month:
```json
{
  "1": 10,   // Alex: 10%
  "2": 40,   // Chris: 40%
  "3": 5,    // Karen: 5%
  "4": 40,   // Sophie: 40%
  "5": 5     // Helen: 5%
}
```

#### POST `/api/monthly-shares`
Updates shares for a specific month:
```json
{
  "monthKey": "2025-05",
  "shares": {
    "1": 20,
    "2": 20,
    "3": 20,
    "4": 20,
    "5": 20
  }
}
```

## Actual Data Verification

### Current Database State

Most months use the standard distribution:
- Alex: 10%
- Chris: 40%
- Karen: 5%
- Sophie: 40%
- Helen: 5%

**Exception**: March 2025 uses equal split (20% each for everyone)

### Test Results

**Test performed**: Changed May 2025 from standard distribution to equal split (20% each)

**Results**:
- ✅ May 2025: Successfully changed to 20% each
- ✅ June 2025: Remained at 10/40/5/40/5 (unchanged)
- ✅ July 2025: Remained at 10/40/5/40/5 (unchanged)
- ✅ February 2025: Remained at 10/40/5/40/5 (unchanged)
- ✅ May 2025: Successfully reverted to original values

## Conclusion

The system is working **100% correctly**:

1. ✅ Each month has its own percentage shares in the database
2. ✅ Changing percentages for one month does NOT affect other months
3. ✅ The UI correctly loads month-specific percentages when switching months
4. ✅ The API correctly saves and retrieves month-specific percentages
5. ✅ Historical months preserve their original percentages even when current defaults change

## User Actions

When you edit participant percentages:
1. Click the edit button (✏️) next to participant shares
2. Modify the percentages
3. Click "Save" or "Cancel"
4. **Only the current month is affected**
5. Other months retain their own percentages

## Edge Cases Handled

1. **New month with no shares**: Inherits from latest month
2. **First month ever**: Uses equal distribution (20% each for 5 people)
3. **Percentages don't sum to 100%**: User is prompted to adjust proportionally
4. **Rounding errors**: Automatically fixed to ensure exactly 100%

## Files Involved

- `src/App.js:174-278` - Month-specific share loading and saving logic
- `api/index.js` - API endpoints for monthly shares
- Database table: `monthly_shares` with `month_key` as part of the key

---

**Verified by**: Claude Code
**Test script**: `test-month-isolation.js`
**Audit script**: See first query in this verification

# How the Duplicate Reports Deduplication Works

## Overview

The system groups reports that are likely about the same incident. It uses three criteria:

## Understanding `forEach` and the `index` Parameter

Before diving into the algorithm, let's understand how `forEach` works:

```javascript
// forEach is a JavaScript array method that loops through each item
// It automatically provides TWO parameters to your callback function:

array.forEach((item, index) => {
  // item - the current element in the array
  // index - the position of that element (starts at 0)
});

// Example:
const fruits = ['apple', 'banana', 'orange'];

fruits.forEach((fruit, index) => {
  console.log(`Index ${index}: ${fruit}`);
});

// Output:
// Index 0: apple
// Index 1: banana
// Index 2: orange
```

**In our code:**
- `reports` is an array of report objects
- `reports.forEach((report, index) => ...)` loops through each report
- `report` = the actual report object (the data)
- `index` = the position in the array (0, 1, 2, 3...)

We use `index` to:
1. Track which reports we've already processed (to avoid duplicates)
2. Compare positions (skip if `index === otherIndex`)

---

## Overview (continued)

The system groups reports that are likely about the same incident. It uses three criteria:
1. **Same emergency type** (Fire, Medical, Police, etc.)
2. **Close location** (within 100 meters OR similar street address)
3. **Close time** (within 10 minutes of each other)

---

## Step-by-Step Process

### Step 1: Grouping Algorithm (`groupDuplicateReports`)

```javascript
function groupDuplicateReports(reports) {
  const grouped = [];
  const processed = new Set();
  
  // Loop through each report
  // forEach automatically provides TWO parameters:
  // 1. report - the current item in the array
  // 2. index - the position of that item (0, 1, 2, 3...)
  reports.forEach((report, index) => {
    // Skip if already processed (already grouped with another report)
    if (processed.has(index)) return;
    
    // Create a new group starting with this report
    const group = {
      primary: report,        // The main report to display
      duplicates: [],        // Other reports that match
      count: 1,              // Total count (starts at 1)
      reporters: [report.reportedBy || 'Unknown']  // List of who reported
    };
    
    // Compare this report with ALL other reports
    // Again, forEach provides: otherReport (the item) and otherIndex (its position)
    reports.forEach((otherReport, otherIndex) => {
      // Skip if same report or already processed
      // We use index and otherIndex to track which reports we've already processed
      if (index === otherIndex || processed.has(otherIndex)) return;
      
      // Check if they're duplicates
      if (areReportsDuplicate(report, otherReport)) {
        // Add to duplicates list
        group.duplicates.push(otherReport);
        group.count++;  // Increment count
        // Add reporter name if not already in list
        if (otherReport.reportedBy && !group.reporters.includes(otherReport.reportedBy)) {
          group.reporters.push(otherReport.reportedBy);
        }
        processed.add(otherIndex);  // Mark as processed
      }
    });
    
    processed.add(index);
    grouped.push(group);
  });
  
  return grouped;
}
```

**Example:**
- Report A (Fire at 10:00 AM)
- Report B (Fire at 10:02 AM) - same location
- Report C (Medical at 10:05 AM) - different type
- Report D (Fire at 10:03 AM) - same location as A & B

**Result:**
- Group 1: {primary: A, duplicates: [B, D], count: 3}
- Group 2: {primary: C, duplicates: [], count: 1}

---

### Step 2: Checking if Reports are Duplicates (`areReportsDuplicate`)

This function checks three conditions:

```javascript
function areReportsDuplicate(report1, report2) {
  // ✅ CONDITION 1: Must be same type
  if (report1.type !== report2.type) return false;
  
  // ✅ CONDITION 2: Must be within 10 minutes
  const timeDiff = Math.abs((report1.rawTimestamp || 0) - (report2.rawTimestamp || 0));
  const tenMinutes = 10 * 60 * 1000; // 10 minutes in milliseconds
  if (timeDiff > tenMinutes) return false;
  
  // ✅ CONDITION 3: Must be close in location
  if (both have GPS coordinates) {
    calculate distance using GPS
    if distance > 100 meters, return false
  } else {
    compare street addresses using string similarity
    if similarity < 70%, return false
  }
  
  return true; // All conditions met = duplicates!
}
```

**Example Scenarios:**

| Report 1 | Report 2 | Type Match? | Time Gap | Location | Result |
|----------|----------|------------|----------|----------|--------|
| Fire 10:00 | Fire 10:05 | ✅ Yes | 5 min | 50m apart | ✅ **DUPLICATE** |
| Fire 10:00 | Medical 10:05 | ❌ No | 5 min | 50m apart | ❌ Not duplicate |
| Fire 10:00 | Fire 10:15 | ✅ Yes | 15 min | 50m apart | ❌ Not duplicate (too long) |
| Fire 10:00 | Fire 10:05 | ✅ Yes | 5 min | 200m apart | ❌ Not duplicate (too far) |

---

### Step 3: GPS Distance Calculation (`calculateDistance`)

Uses the **Haversine formula** to calculate distance between two GPS coordinates.

```javascript
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  
  // Convert degrees to radians
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  // Haversine formula
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
}
```

**Why Haversine?**
- Earth is a sphere, not flat
- Regular distance formula (Pythagorean) doesn't work for GPS coordinates
- Haversine accounts for Earth's curvature

**Example:**
- Point A: 14.5995°N, 120.9842°E (Manila)
- Point B: 14.6000°N, 120.9845°E (100 meters away)
- Result: ~55 meters apart ✅ (within 100m threshold)

---

### Step 4: String Similarity (When No GPS Available)

When reports don't have GPS coordinates, we compare street addresses.

```javascript
function calculateStringSimilarity(str1, str2) {
  // Find longer and shorter string
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  if (longer.length === 0) return 1.0; // Both empty = 100% similar
  
  // Calculate Levenshtein distance
  const distance = levenshteinDistance(longer, shorter);
  
  // Convert to similarity percentage
  return (longer.length - distance) / longer.length;
}
```

**Levenshtein Distance** = minimum number of single-character edits (insertions, deletions, substitutions) needed to change one string into another.

**Example:**
- String 1: "Block 3, Lot 5"
- String 2: "Block 3 Lot 5" (missing comma)
- Distance: 1 (one character difference)
- Similarity: (14 - 1) / 14 = 92.8% ✅ (above 70% threshold)

**More Examples:**

| Address 1 | Address 2 | Distance | Similarity | Match? |
|-----------|-----------|----------|------------|--------|
| "Block 3, Lot 5" | "Block 3, Lot 5" | 0 | 100% | ✅ Yes |
| "Block 3, Lot 5" | "Block 3 Lot 5" | 1 | 92.8% | ✅ Yes |
| "Block 3, Lot 5" | "Block 4, Lot 5" | 1 | 92.8% | ✅ Yes |
| "Block 3, Lot 5" | "Main Street" | 12 | 14.3% | ❌ No |

---

### Step 5: Levenshtein Distance Algorithm

**Purpose:** This function calculates how different two strings are by counting the minimum number of character edits (insertions, deletions, substitutions) needed to transform one string into another.

**Why we need it:** When reports don't have GPS coordinates, we need to compare street addresses. But addresses might have typos, missing commas, or slight variations. Levenshtein distance helps us find addresses that are "almost the same" even if they're not exactly identical.

**Real-world example:**
- Report 1: "Block 3, Lot 5"
- Report 2: "Block 3 Lot 5" (missing comma)
- Report 3: "Block 3, Lot 6" (different lot number)
- Report 4: "Main Street" (completely different)

Without Levenshtein: We'd only match exact strings → Report 1 and 2 wouldn't match (false negative)
With Levenshtein: We calculate similarity → Report 1 and 2 are 92% similar → They match! ✅

This is a dynamic programming algorithm that builds a matrix to find the minimum edits needed.

```javascript
function levenshteinDistance(str1, str2) {
  // Create a matrix: rows = str2, columns = str1
  const matrix = [];
  
  // Initialize first row and column (base cases)
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];  // First column: 0, 1, 2, 3...
  }
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;  // First row: 0, 1, 2, 3...
  }
  
  // Fill the matrix
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        // Characters match - no edit needed
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        // Characters don't match - find minimum of:
        // 1. Substitution (diagonal)
        // 2. Insertion (left)
        // 3. Deletion (up)
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,  // Substitute
          matrix[i][j - 1] + 1,      // Insert
          matrix[i - 1][j] + 1       // Delete
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}
```

**Visual Example: "cat" vs "bat"**

The matrix shows the minimum edits needed to transform one string into another:

```
     ""  c  a  t
  ""  0  1  2  3  ← To make "" into "cat": need 3 insertions (c, a, t)
  b   1  1  2  3  ← To make "b" into "cat": substitute b→c (1), then add a, t (2 more)
  a   2  2  1  2  ← To make "ba" into "cat": substitute b→c (1), a matches, add t (1 more)
  t   3  3  2  1  ← Final answer: 1 edit (substitute c→b, a and t already match)
```

**Step-by-step walkthrough:**

1. **Initialize matrix** - First row/column show cost of inserting all characters
2. **Fill matrix** - For each cell, check:
   - If characters match → no cost, use diagonal value
   - If characters differ → find minimum of:
     - **Substitute** (diagonal): Change one character to another
     - **Insert** (left): Add a character
     - **Delete** (up): Remove a character
3. **Bottom-right cell** = minimum edits needed

**Real example for addresses:**

Comparing "Block 3, Lot 5" vs "Block 3 Lot 5":

```
Distance = 1 (one character difference: the comma)
Similarity = (14 - 1) / 14 = 92.8%
Since 92.8% > 70% threshold → They match! ✅
```

**Why this matters in your system:**

When a user reports an incident, they might type:
- "Block 3, Lot 5" (with comma)
- "Block 3 Lot 5" (without comma)
- "Block 3, Lot5" (no space)
- "block 3 lot 5" (lowercase)

All of these should be recognized as the same location! Levenshtein distance makes this possible.

---

## Complete Flow Example

Let's trace through a real scenario:

**Input Reports:**
1. Report A: Fire, 10:00 AM, GPS: (14.5995, 120.9842), Reported by: Alice
2. Report B: Fire, 10:02 AM, GPS: (14.5996, 120.9843), Reported by: Bob
3. Report C: Medical, 10:03 AM, GPS: (14.5995, 120.9842), Reported by: Carol
4. Report D: Fire, 10:08 AM, GPS: (14.5995, 120.9842), Reported by: David

**Processing:**

1. **Check Report A vs B:**
   - Type: Fire = Fire ✅
   - Time: |10:00 - 10:02| = 2 minutes ✅ (< 10 min)
   - Distance: ~111 meters ❌ (> 100m)
   - **Result: NOT duplicates**

2. **Check Report A vs C:**
   - Type: Fire ≠ Medical ❌
   - **Result: NOT duplicates**

3. **Check Report A vs D:**
   - Type: Fire = Fire ✅
   - Time: |10:00 - 10:08| = 8 minutes ✅ (< 10 min)
   - Distance: ~0 meters ✅ (< 100m)
   - **Result: DUPLICATES!**

4. **Check Report B vs C:**
   - Type: Fire ≠ Medical ❌
   - **Result: NOT duplicates**

5. **Check Report B vs D:**
   - Type: Fire = Fire ✅
   - Time: |10:02 - 10:08| = 6 minutes ✅ (< 10 min)
   - Distance: ~111 meters ❌ (> 100m)
   - **Result: NOT duplicates**

**Final Groups:**
- Group 1: {primary: A, duplicates: [D], count: 2, reporters: [Alice, David]}
- Group 2: {primary: B, duplicates: [], count: 1, reporters: [Bob]}
- Group 3: {primary: C, duplicates: [], count: 1, reporters: [Carol]}

---

## Configuration Values

You can adjust these thresholds in `areReportsDuplicate()`:

| Setting | Current Value | What it does | How to change |
|---------|--------------|--------------|---------------|
| **Time Window** | 10 minutes | How close in time reports must be | Change `tenMinutes` variable |
| **Distance Threshold** | 100 meters | How close reports must be (GPS) | Change `100` in distance check |
| **Similarity Threshold** | 70% (0.7) | How similar addresses must be | Change `0.7` in similarity check |

**Example adjustments:**
- **Stricter matching** (fewer false positives):
  - Time: 5 minutes
  - Distance: 50 meters
  - Similarity: 0.8 (80%)
  
- **More lenient matching** (catch more duplicates):
  - Time: 15 minutes
  - Distance: 200 meters
  - Similarity: 0.6 (60%)

---

## Performance Considerations

**Time Complexity:**
- For N reports, we compare each report with every other report
- This is O(N²) - quadratic time complexity
- For 100 reports: 100 × 100 = 10,000 comparisons
- For 1000 reports: 1,000,000 comparisons

**Optimization Ideas (if needed):**
1. **Spatial indexing** - Group reports by location grid first
2. **Time bucketing** - Only compare reports in same time window
3. **Early exit** - Stop checking once type doesn't match

For most use cases (< 1000 reports), current implementation is fast enough.

---

## Edge Cases Handled

1. **Missing GPS coordinates** → Falls back to string similarity
2. **Missing timestamps** → Uses 0, which will fail time check (safe)
3. **Missing street address** → Empty string comparison
4. **Same reporter multiple times** → Only counted once in reporters list
5. **Reports with no matches** → Shown as single-item groups

---

## Summary

The algorithm works by:
1. **Comparing every report with every other report**
2. **Checking three conditions** (type, time, location)
3. **Grouping matches together** with the first report as primary
4. **Displaying grouped results** with duplicate count badges

This ensures that when multiple people report the same incident, they're grouped together instead of cluttering the reports page!

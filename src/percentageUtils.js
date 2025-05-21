// percentageUtils.js
export const formatPercentage = (value) => {
  // Parse the value and ensure it's limited to two decimal places
  const parsed = parseFloat(value);
  if (isNaN(parsed)) return 0;
  return parseFloat(parsed.toFixed(2));
};

export const fixRoundingIssues = (people) => {
  const total = people.reduce((sum, p) => sum + parseFloat(p.percentShare || 0), 0);
  const diff = 100 - total;
  
  if (Math.abs(diff) > 0.01 && people.length > 0) {
    // Add or subtract the tiny difference from the person with the largest share
    const personWithLargestShare = [...people].sort((a, b) => 
      parseFloat(b.percentShare) - parseFloat(a.percentShare)
    )[0];
    
    const index = people.findIndex(p => p.id === personWithLargestShare.id);
    if (index >= 0) {
      people[index].percentShare = formatPercentage(parseFloat(people[index].percentShare) + diff);
    }
  }
};
function findMaxDifference(a, b, c) {
    // Flatten all numbers into a single array while marking their source
    let allNumbers = [];
  
    if (typeof a === 'number') {
      allNumbers.push({ price: a, source: 'a', token: 'a' });
    }
  
    if (Array.isArray(b)) {
      for (let obj of b) {
        allNumbers.push({ price: obj.price, source: 'b', token: obj.token });
      }
    }
  
    if (Array.isArray(c)) {
      for (let obj of c) {
        allNumbers.push({ price: obj.price, source: 'c', token: obj.token });
      }
    }
  
    // If there are less than 2 numbers, return null
    if (allNumbers.length < 2) {
      return null;
    }
  
    // Sort numbers by their price
    allNumbers.sort((x, y) => x.price - y.price);
  
    let maxDiff = -Infinity;
    let result = null;
  
    // Iterate to find the maximum difference with different sources
    for (let i = 0; i < allNumbers.length; i++) {
      for (let j = i + 1; j < allNumbers.length; j++) {
        if (allNumbers[i].source !== allNumbers[j].source) {
          let diff = allNumbers[j].price - allNumbers[i].price;
          if (diff > maxDiff) {
            maxDiff = diff;
            result = {
              price_difference: diff,
              From: allNumbers[i].token,
              To: allNumbers[j].token
            };
          }
        }
      }
    }
  
    return result;
  }
  
  // Example usage:
  let a = 5;
  let b = [
    { token: "0x123", price: 1 },
    { token: "0x456", price: 2 },
    { token: "0x789", price: 8 }
  ];
  let c = [
    { token: "0xabc", price: 3 },
    { token: "0xdef", price: 9 },
    { token: "0xghi", price: 10 }
  ];
  
  console.log(findMaxDifference(a, b, c));
  // Output should be something like: 
  // { price_difference: 9, From: '0x123', To: '0xghi' } 
  // or { price_difference: 9, From: 'a', To: '0xghi' } depending on the input arrays
  
// Test the improved fetch-chunk tool
import { fetchChunkTool } from './dist/tools/fetch-chunk.tool.js';

async function testFetchChunkTool() {
  console.log('=== Testing improved fetch-chunk tool ===');
  
  // Test 1: Non-existent cache ID
  console.log('1. Testing non-existent cache ID:');
  const failingResult = await fetchChunkTool.execute({
    cacheId: '4bd36a2f-8306-48f4-b3c5-3ad896ae83c8',
    chunkNumber: 1
  });
  console.log(failingResult);
  
  // Test 2: Existing cache ID  
  console.log('\n2. Testing existing cache ID:');
  const existingCacheId = '10d8e905-8591-43ea-b310-e5ccf5a2da72'; // From current list
  const successResult = await fetchChunkTool.execute({
    cacheId: existingCacheId,
    chunkNumber: 1
  });
  console.log(successResult.substring(0, 200) + '...');
  
  // Test 3: Out of bounds chunk number
  console.log('\n3. Testing out of bounds chunk number:');
  const outOfBoundsResult = await fetchChunkTool.execute({
    cacheId: existingCacheId,
    chunkNumber: 999
  });
  console.log(outOfBoundsResult);
}

testFetchChunkTool().catch(console.error);
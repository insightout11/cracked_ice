export async function fetchWithTimeout(url: string, ms = 10000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  
  try {
    console.log(`[HTTP] fetching: ${url}`);
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    console.log(`[HTTP] success: ${url}`);
    return res;
  } catch (error) {
    console.log(`[HTTP] failed: ${url} - ${error}`);
    throw error;
  } finally {
    clearTimeout(id);
  }
}
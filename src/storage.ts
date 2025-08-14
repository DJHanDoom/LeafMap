export async function saveData(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}
export async function loadData<T>(key: string): Promise<T | null> {
  const v = localStorage.getItem(key)
  return v ? JSON.parse(v) as T : null
}

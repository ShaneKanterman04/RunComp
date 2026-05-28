export function jsonRequest(path: string, body: unknown, method = "POST") {
  return new Request(`http://localhost${path}`, {
    method,
    body: JSON.stringify(body),
  });
}

export async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

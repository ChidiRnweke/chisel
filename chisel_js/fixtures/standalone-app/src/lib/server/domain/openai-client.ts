// ANTI-PATTERN: "domain" is not a layer. An adapter wrapping an external
// capability is a service; repositories are persistence.
export class OpenAiClient {
  async complete(prompt: string): Promise<string> {
    return prompt;
  }
}

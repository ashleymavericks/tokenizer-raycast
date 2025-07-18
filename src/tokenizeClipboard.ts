import { Clipboard, getPreferenceValues, showToast, Toast, environment } from "@raycast/api";
import { TiktokenEncoding } from "@dqbd/tiktoken";
import { get_encoding, init } from "@dqbd/tiktoken/init";
import { promises as fs } from "fs";
import path from "path";

const wasmURL = "https://github.com/ashleymavericks/tokenizer-raycast/releases/download/binary/tiktoken_bg.wasm";

let initialized = false;
async function initialize() {
  if (initialized) {
    return;
  }

  const wasmPath = path.join(environment.supportPath, "tiktoken_bg.wasm");
  let wasm: Buffer;

  try {
    wasm = await fs.readFile(wasmPath);
  } catch (error) {
    const toast = await showToast({ style: Toast.Style.Animated, title: "Downloading Tokenizer..." });

    try {
      const response = await fetch(wasmURL);
      if (!response.ok) {
        throw new Error(`Failed to download WASM module: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      wasm = Buffer.from(arrayBuffer);
      await fs.mkdir(path.dirname(wasmPath), { recursive: true });
      await fs.writeFile(wasmPath, wasm);

      toast.style = Toast.Style.Success;
      toast.title = "Tokenizer Ready";
    } catch (downloadError) {
      toast.style = Toast.Style.Failure;
      toast.title = "Failed to download tokenizer";
      toast.message = downloadError instanceof Error ? downloadError.message : String(downloadError);
      throw downloadError;
    }
  }

  await init((imports) => WebAssembly.instantiate(wasm, imports));
  initialized = true;
}

interface Preferences {
  tokenizer: TiktokenEncoding;
}

export default async function Command() {
  try {
    await initialize();
    const { tokenizer }: Preferences = getPreferenceValues();
    const encoder = get_encoding(tokenizer);

    const clipboardText = await Clipboard.readText();

    if (!clipboardText || !clipboardText.trim()) {
      throw new Error("No text in clipboard.");
    }

    const tokens = encoder.encode(clipboardText);
    const tokenCount = tokens.length;

    encoder.free();

    await showToast({
      style: Toast.Style.Success,
      title: `${tokenCount} tokens (${tokenizer})`,
    });
  } catch (err) {
    await showToast({
      style: Toast.Style.Failure,
      title: err instanceof Error ? `Error: ${err.message}` : `Error: Could not count tokens from clipboard`,
    });
  }
}

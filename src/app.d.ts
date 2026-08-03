// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface Platform {}
	}

	// The File System Access API is not in TypeScript's DOM lib yet. Only the parts the
	// drag-and-drop mode uses are declared here.
	interface FileSystemHandle {
		readonly kind: 'file' | 'directory';
		readonly name: string;
	}

	interface FileSystemFileHandle extends FileSystemHandle {
		readonly kind: 'file';
		getFile(): Promise<File>;
	}

	interface OpenFilePickerOptions {
		types?: { description?: string; accept: Record<string, string[]> }[];
		multiple?: boolean;
	}

	interface Window {
		showOpenFilePicker(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>;
	}
}

export {};

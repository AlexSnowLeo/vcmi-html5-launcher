export interface DB {
    put: (key: string, data: Uint8Array) => Promise<void>;
    get: (key: string) => Promise<Uint8Array | null>;
    keys: () => Promise<string[]>;
    delete: (key: string) => Promise<void>;
    clear: () => Promise<void>;
    forEach: (each: (key: string, value: Uint8Array) => void) => Promise<void>;
    close: () => void;
}

export class DBNoop implements DB {
    public close() {
    }

    public put(key: string, data: Uint8Array): Promise<void> {
        return Promise.resolve();
    }

    public get(key: string): Promise<Uint8Array | null> {
        return Promise.resolve(null);
    }

    public delete(key: string): Promise<void> {
        return Promise.resolve();
    }

    public clear(): Promise<void> {
        return Promise.resolve();
    }

    public keys(): Promise<string[]> {
        return Promise.resolve([]);
    }

    public forEach(each: (key: string, value: Uint8Array) => void) {
        return Promise.resolve();
    }
}

class IndexedDB implements DB {
    private storeName = "files";
    private indexedDB: IDBFactory;
    private db: IDBDatabase | null = null;

    constructor(
        name: string,
        onready: (cache: DB) => void,
        onerror: (msg: string) => void,
    ) {
        this.indexedDB = (typeof window === "undefined" ? undefined : window.indexedDB ||
            (window as any).mozIndexedDB ||
            (window as any).webkitIndexedDB || (window as any).msIndexedDB) as any;

        if (!this.indexedDB) {
            onerror("Indexed db is not supported on this host");
            return;
        }

        try {
            const openRequest = this.indexedDB.open(name, 1);
            openRequest.onerror = (event) => {
                onerror("Can't open cache database: " + openRequest.error?.message);
            };
            openRequest.onsuccess = (event) => {
                this.db = openRequest.result;
                onready(this);
            };
            openRequest.onupgradeneeded = (event) => {
                try {
                    this.db = openRequest.result;
                    this.db.onerror = (event) => {
                        onerror("Can't upgrade cache database");
                    };

                    const objectStore = this.db.createObjectStore(this.storeName);
                    objectStore.createIndex("key", "", {
                        unique: true,
                        multiEntry: false,
                    });
                } catch (e) {
                    onerror("Can't upgrade cache database");
                }
            };
        } catch (e: any) {
            onerror("Can't open cache database: " + e.message);
        }
    }

    private async resultToUint8Array(result: ArrayBuffer | Blob): Promise<Uint8Array> {
        if (result instanceof Blob) {
            return new Uint8Array(await result.arrayBuffer());
        }
        return new Uint8Array(result);
    }

    public close() {
        if (this.db !== null) {
            this.db.close();
            this.db = null;
        }
    }

    public put(key: string, data: Uint8Array): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (this.db === null) {
                resolve();
                return;
            }

            const transaction = this.db.transaction(this.storeName, "readwrite");
            const request = transaction.objectStore(this.storeName).put(new Blob([data.buffer]), key);
            request.onerror = (e) => {
                reject(new Error("Can't put key '" + key + "'"));
                console.error(e);
            };
            request.onsuccess = () => resolve();
        });
    }

    public get(key: string): Promise<Uint8Array | null> {
        return new Promise<Uint8Array | null>((resolve, reject) => {
            if (this.db === null) {
                reject(new Error("db is not initalized"));
                return;
            }

            const transaction = this.db.transaction(this.storeName, "readonly");
            const request = transaction.objectStore(this.storeName).get(key) as IDBRequest<ArrayBuffer | Blob>;
            request.onerror = () => reject(new Error("Can't read value for key '" + key + "'"));
            request.onsuccess = () => {
                if (request.result) {
                    resolve(this.resultToUint8Array(request.result));
                } else {
                    resolve(null);
                }
            };
        });
    }

    public delete(key: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (this.db === null) {
                reject(new Error("db is not initalized"));
                return;
            }

            const transaction = this.db.transaction(this.storeName, "readwrite");
            const request = transaction.objectStore(this.storeName).delete(key);
            request.onerror = () => reject(new Error("Can't delete value for key '" + key + "'"));
            request.onsuccess = () => resolve();
        });
    }

    public async clear(): Promise<void> {
        const keys = await this.keys();
        for (const key of keys) {
            await this.delete(key);
        }
    }

    public keys(): Promise<string[]> {
        return new Promise<string[]>((resolve, reject) => {
            if (this.db === null) {
                resolve([]);
                return;
            }

            const transaction = this.db.transaction(this.storeName, "readonly");
            const request = transaction.objectStore(this.storeName).getAllKeys();
            request.onerror = reject;
            request.onsuccess = (event) => {
                if (request.result) {
                    resolve(request.result as string[]);
                } else {
                    resolve([]);
                }
            };
        });
    }

    public async forEach(each: (key: string, value: Uint8Array) => void): Promise<void> {
        const keys = await this.keys();
        for (const key of keys) {
            const value = await this.get(key);
            if (value) {
                each(key, value);
            }
        }
    }
}

const gameDBPromise: Promise<DB> = (() => {
    return new Promise((resolve) => {
        new IndexedDB("vcmi-variant", resolve, (msg: string) => {
            console.error("Can't open IndexedDB cache", msg);
            resolve(new DBNoop());
        });
    });
})();

const dataDBPromise: Promise<DB> = (() => {
    return new Promise((resolve) => {
        new IndexedDB("vcmi-data", resolve, (msg: string) => {
            console.error("Can't open IndexedDB cache", msg);
            resolve(new DBNoop());
        });
    });
})();

const filesDBPromise: Promise<DB> = (() => {
    return new Promise((resolve) => {
        new IndexedDB("vcmi-files", resolve, (msg: string) => {
            console.error("Can't open IndexedDB cache", msg);
            resolve(new DBNoop());
        });
    });
})();

export const getGameDB = () => gameDBPromise;
export const getDataDB = () => dataDBPromise;
export const getFilesDB = () => filesDBPromise;


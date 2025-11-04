/**
 * KV Cache Wrapper
 * 
 * This wrapper adds cacheTtl to KV get operations to reduce the number of actual KV reads.
 * Cloudflare's edge cache will serve cached values without counting against KV read limits.
 * 
 * IMPORTANT: Only use this for data that doesn't change frequently (like tokens that are already
 * timestamped). The cacheTtl should be shorter than the token expiration time to ensure expired
 * tokens are detected quickly.
 */

export interface CachedKVNamespace {
  get(
    key: string,
    options?: { type?: "text" | "json" | "arrayBuffer" | "stream"; cacheTtl?: number }
  ): Promise<string | null>;
  get(
    key: string,
    type: "text",
    options?: { cacheTtl?: number }
  ): Promise<string | null>;
  get<ExpectedValue = unknown>(
    key: string,
    type: "json",
    options?: { cacheTtl?: number }
  ): Promise<ExpectedValue | null>;
  get(
    key: string,
    type: "arrayBuffer",
    options?: { cacheTtl?: number }
  ): Promise<ArrayBuffer | null>;
  get(
    key: string,
    type: "stream",
    options?: { cacheTtl?: number }
  ): Promise<ReadableStream | null>;
  put(
    key: string,
    value: string | ArrayBuffer | ArrayBufferView | ReadableStream,
    options?: { expiration?: number; expirationTtl?: number; metadata?: any }
  ): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: {
    prefix?: string | null;
    limit?: number;
    cursor?: string | null;
  }): Promise<any>;
}

/**
 * Creates a cached wrapper around a KV namespace.
 * 
 * @param kvNamespace - The original KV namespace
 * @param defaultCacheTtl - Default cache TTL in seconds for get operations (default: 60)
 * @returns A wrapped KV namespace with automatic caching
 */
export function createCachedKV(
  kvNamespace: KVNamespace,
  defaultCacheTtl: number = 60
): KVNamespace {
  // Use Proxy to intercept all KV operations and add caching
  return new Proxy(kvNamespace, {
    get(target, prop, receiver) {
      const original = Reflect.get(target, prop, receiver);
      
      // Only wrap the get method
      if (prop === 'get') {
        return function(
          key: string | string[],
          optionsOrType?: { type?: "text" | "json" | "arrayBuffer" | "stream"; cacheTtl?: number } | "text" | "json" | "arrayBuffer" | "stream",
          options?: { cacheTtl?: number }
        ): Promise<any> {
          // Handle different function signatures
          let type: "text" | "json" | "arrayBuffer" | "stream" | undefined;
          let cacheTtl = defaultCacheTtl;

          if (typeof optionsOrType === "string") {
            // Called as: get(key, type, options?)
            type = optionsOrType;
            if (options?.cacheTtl !== undefined) {
              cacheTtl = options.cacheTtl;
            }
          } else if (optionsOrType) {
            // Called as: get(key, options)
            type = optionsOrType.type;
            if (optionsOrType.cacheTtl !== undefined) {
              cacheTtl = optionsOrType.cacheTtl;
            }
          }

          // For token keys, use a shorter cache TTL (60 seconds - minimum allowed by Cloudflare KV)
          // For grant and client keys, use longer cache TTL (5 minutes) since they change less frequently
          let finalCacheTtl = cacheTtl;
          const keyStr = Array.isArray(key) ? key[0] : key;
          if (keyStr && keyStr.startsWith("token:")) {
            finalCacheTtl = 60; // Token validation - minimum cache TTL required by Cloudflare KV
          } else if (keyStr && (keyStr.startsWith("grant:") || keyStr.startsWith("client:"))) {
            finalCacheTtl = 300; // Grants and clients change less frequently
          }

          // Add cacheTtl to the KV get operation
          if (Array.isArray(key)) {
            // Handle array of keys
            if (type === "json") {
              return original.call(target, key, { type: "json", cacheTtl: finalCacheTtl });
            } else if (type === "text") {
              return original.call(target, key, { type: "text", cacheTtl: finalCacheTtl });
            } else {
              return original.call(target, key, { cacheTtl: finalCacheTtl });
            }
          } else {
            // Handle single key
            if (type === "json") {
              return original.call(target, key, { type: "json", cacheTtl: finalCacheTtl });
            } else if (type === "text") {
              return original.call(target, key, { type: "text", cacheTtl: finalCacheTtl });
            } else if (type === "arrayBuffer") {
              return original.call(target, key, { type: "arrayBuffer", cacheTtl: finalCacheTtl });
            } else if (type === "stream") {
              return original.call(target, key, { type: "stream", cacheTtl: finalCacheTtl });
            } else {
              return original.call(target, key, { cacheTtl: finalCacheTtl });
            }
          }
        };
      }
      
      // Return original for all other properties
      return original;
    }
  }) as KVNamespace;
}

// Keep the old implementation as a fallback (not used but kept for reference)
export function createCachedKV_old(
  kvNamespace: KVNamespace,
  defaultCacheTtl: number = 60
): CachedKVNamespace {
  return {
    get(
      key: string,
      optionsOrType?: { type?: "text" | "json" | "arrayBuffer" | "stream"; cacheTtl?: number } | "text" | "json" | "arrayBuffer" | "stream",
      options?: { cacheTtl?: number }
    ): Promise<any> {
      // Handle different function signatures
      let type: "text" | "json" | "arrayBuffer" | "stream" | undefined;
      let cacheTtl = defaultCacheTtl;

      if (typeof optionsOrType === "string") {
        // Called as: get(key, type, options?)
        type = optionsOrType;
        if (options?.cacheTtl !== undefined) {
          cacheTtl = options.cacheTtl;
        }
      } else if (optionsOrType) {
        // Called as: get(key, options)
        type = optionsOrType.type;
        if (optionsOrType.cacheTtl !== undefined) {
          cacheTtl = optionsOrType.cacheTtl;
        }
      }

      // For token keys, use a shorter cache TTL (60 seconds - minimum allowed by Cloudflare KV)
      // For grant and client keys, use longer cache TTL (5 minutes) since they change less frequently
      let finalCacheTtl = cacheTtl;
      if (key.startsWith("token:")) {
        finalCacheTtl = 60; // Token validation - minimum cache TTL required by Cloudflare KV
      } else if (key.startsWith("grant:") || key.startsWith("client:")) {
        finalCacheTtl = 300; // Grants and clients change less frequently
      }

      // Add cacheTtl to the KV get operation
      if (type === "json") {
        return kvNamespace.get(key, { type: "json", cacheTtl: finalCacheTtl });
      } else if (type === "text") {
        return kvNamespace.get(key, { type: "text", cacheTtl: finalCacheTtl });
      } else if (type === "arrayBuffer") {
        return kvNamespace.get(key, { type: "arrayBuffer", cacheTtl: finalCacheTtl });
      } else if (type === "stream") {
        return kvNamespace.get(key, { type: "stream", cacheTtl: finalCacheTtl });
      } else {
        return kvNamespace.get(key, { cacheTtl: finalCacheTtl });
      }
    },

    put(
      key: string,
      value: string | ArrayBuffer | ArrayBufferView | ReadableStream,
      options?: { expiration?: number; expirationTtl?: number; metadata?: any }
    ): Promise<void> {
      return kvNamespace.put(key, value, options);
    },

    delete(key: string): Promise<void> {
      return kvNamespace.delete(key);
    },

    list(options?: {
      prefix?: string | null;
      limit?: number;
      cursor?: string | null;
    }): Promise<any> {
      return kvNamespace.list(options);
    },
  };
}

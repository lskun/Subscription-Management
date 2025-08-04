import { supabase } from '@/lib/supabase';

/**
 * 全局缓存服务
 * 用于统一缓存各种请求，避免重复请求相同的数据
 */
export class GlobalCacheService {
  // 缓存持续时间（毫秒）
  private static readonly CACHE_DURATION = 30 * 1000; // 30秒

  // 缓存数据
  private static cache: Record<string, { data: any; timestamp: number }> = {};

  // 用于存储正在进行的请求Promise
  private static promiseCache: Record<string, Promise<any>> = {};

  /**
   * 生成缓存键
   * @param type 数据类型
   * @param id 唯一标识符
   * @returns 缓存键
   */
  static generateCacheKey(type: string, id: string): string {
    return `${type}:${id}`;
  }

  /**
   * 获取缓存数据
   * @param key 缓存键
   * @returns 缓存数据和Promise
   */
  static get<T>(key: string): { data: T | null; promise: Promise<T> | null } {
    const now = Date.now();
    const cached = this.cache[key];

    // 检查缓存是否存在且未过期
    if (cached && now - cached.timestamp < this.CACHE_DURATION) {
      return { data: cached.data, promise: null };
    }

    // 检查是否有正在进行的请求
    const promise = this.promiseCache[key] as Promise<T> | undefined;
    return { data: null, promise: promise || null };
  }

  /**
   * 设置缓存数据
   * @param key 缓存键
   * @param data 数据
   */
  static set<T>(key: string, data: T): void {
    this.cache[key] = {
      data,
      timestamp: Date.now(),
    };
  }

  /**
   * 设置Promise
   * @param key 缓存键
   * @param promise Promise
   */
  static setPromise<T>(key: string, promise: Promise<T>): void {
    this.promiseCache[key] = promise;
  }

  /**
   * 清除缓存
   * @param key 缓存键
   */
  static clear(key: string): void {
    delete this.cache[key];
  }

  /**
   * 按类型清除缓存
   * @param type 数据类型
   */
  static clearByType(type: string): void {
    const prefix = `${type}:`;
    Object.keys(this.cache).forEach((key) => {
      if (key.startsWith(prefix)) {
        delete this.cache[key];
      }
    });
  }

  /**
   * 按ID清除缓存
   * @param id 唯一标识符
   */
  static clearById(id: string): void {
    Object.keys(this.cache).forEach((key) => {
      if (key.endsWith(`:${id}`)) {
        delete this.cache[key];
      }
    });
  }

  /**
   * 清除Promise引用
   * @param key 缓存键
   */
  static clearPromise(key: string): void {
    delete this.promiseCache[key];
  }

  /**
   * 缓存Supabase请求
   * 用于统一缓存从Supabase获取的数据
   * @param url 请求URL
   * @param fetchFunction 获取数据的函数
   * @returns 请求结果
   */
  static async cacheSupabaseRequest<T>(
    url: string,
    fetchFunction: () => Promise<T>
  ): Promise<T> {
    // 使用URL作为缓存键
    const cacheKey = `supabase:${url}`;
    
    // 检查缓存
    const cached = this.get<T>(cacheKey);
    
    if (cached.data) {
      return cached.data;
    }
    
    if (cached.promise) {
      return cached.promise;
    }

    // 创建新的获取Promise
    const fetchPromise = (async () => {
      try {
        const result = await fetchFunction();
        
        // 设置缓存
        this.set(cacheKey, result);
        return result;
      } finally {
        // 请求完成后清除Promise引用
        this.clearPromise(cacheKey);
      }
    })();

    // 存储Promise以便去重
    this.setPromise(cacheKey, fetchPromise);
    return fetchPromise;
  }

  /**
   * 清除特定URL的缓存
   * @param url 请求URL
   */
  static clearUrlCache(url: string): void {
    const cacheKey = `supabase:${url}`;
    this.clear(cacheKey);
  }
}
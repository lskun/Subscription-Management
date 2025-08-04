import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
  fullScreen?: boolean;
}

/**
 * 统一的加载组件
 * 支持不同尺寸和全屏模式
 */
export function Loading({ 
  size = 'md', 
  text = '加载中...', 
  className,
  fullScreen = false 
}: LoadingProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  const content = (
    <div className={cn(
      "flex flex-col items-center justify-center space-y-3",
      fullScreen && "min-h-screen",
      className
    )}>
      <Loader2 className={cn(
        "animate-spin text-blue-600",
        sizeClasses[size]
      )} />
      {text && (
        <p className={cn(
          "text-gray-600 font-medium",
          textSizeClasses[size]
        )}>
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white bg-opacity-90 z-50 flex items-center justify-center">
        {content}
      </div>
    );
  }

  return content;
}

/**
 * 页面级别的加载组件
 */
export function PageLoading({ text = '页面加载中...' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loading size="lg" text={text} />
    </div>
  );
}

/**
 * 内联加载组件
 */
export function InlineLoading({ text = '加载中...' }: { text?: string }) {
  return (
    <div className="flex items-center space-x-2 py-2">
      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
      <span className="text-sm text-gray-600">{text}</span>
    </div>
  );
}

/**
 * 按钮加载状态组件
 */
export function ButtonLoading() {
  return (
    <Loader2 className="h-4 w-4 animate-spin" />
  );
}

export default Loading;
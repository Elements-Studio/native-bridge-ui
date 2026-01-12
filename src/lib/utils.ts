import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function asyncMap<T>(array: T[], callback: (item: T, index: number, array: T[]) => Promise<any>) {
  return Promise.all(array.map(callback))
}

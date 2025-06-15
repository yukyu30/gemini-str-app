import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { useToast, toast } from './use-toast'

describe('useToast', () => {
  beforeEach(() => {
    // Reset toast state before each test
    // Clear any existing toasts
    const { result } = renderHook(() => useToast())
    act(() => {
      result.current.toasts.forEach(t => result.current.dismiss(t.id))
    })
  })

  it('should start with empty toasts array', () => {
    const { result } = renderHook(() => useToast())
    expect(result.current.toasts).toEqual([])
  })

  it('should add a toast when toast is called', () => {
    const { result } = renderHook(() => useToast())
    
    act(() => {
      toast({
        title: 'Test Title',
        description: 'Test Description'
      })
    })

    expect(result.current.toasts).toHaveLength(1)
    expect(result.current.toasts[0]).toMatchObject({
      title: 'Test Title',
      description: 'Test Description',
      open: true
    })
  })

  it('should add success variant toast', () => {
    const { result } = renderHook(() => useToast())
    
    act(() => {
      toast({
        variant: 'success',
        title: 'Success',
        description: 'Operation completed successfully'
      })
    })

    expect(result.current.toasts[0]).toMatchObject({
      variant: 'success',
      title: 'Success',
      description: 'Operation completed successfully'
    })
  })

  it('should add destructive variant toast', () => {
    const { result } = renderHook(() => useToast())
    
    act(() => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Something went wrong'
      })
    })

    expect(result.current.toasts[0]).toMatchObject({
      variant: 'destructive',
      title: 'Error',
      description: 'Something went wrong'
    })
  })

  it('should dismiss a toast', () => {
    const { result } = renderHook(() => useToast())
    
    act(() => {
      toast({
        title: 'Test Toast',
        description: 'Will be dismissed'
      })
    })

    expect(result.current.toasts).toHaveLength(1)
    const toastId = result.current.toasts[0].id

    act(() => {
      result.current.dismiss(toastId)
    })

    expect(result.current.toasts[0].open).toBe(false)
  })

  it('should limit toasts to TOAST_LIMIT', () => {
    const { result } = renderHook(() => useToast())
    
    // Add multiple toasts (limit is 1)
    act(() => {
      toast({ title: 'Toast 1' })
      toast({ title: 'Toast 2' })
      toast({ title: 'Toast 3' })
    })

    expect(result.current.toasts).toHaveLength(1)
    expect(result.current.toasts[0].title).toBe('Toast 3')
  })

  it('should dismiss all toasts when no toastId is provided', () => {
    const { result } = renderHook(() => useToast())
    
    act(() => {
      toast({ title: 'Toast 1' })
    })

    expect(result.current.toasts).toHaveLength(1)

    act(() => {
      result.current.dismiss()
    })

    expect(result.current.toasts[0].open).toBe(false)
  })
})
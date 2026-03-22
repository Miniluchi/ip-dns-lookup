'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CopyButtonProps {
  value: string
  className?: string
}

export function CopyButton({ value, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className={`size-6 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ${className ?? ''}`}
      onClick={handleCopy}
      aria-label="Copy value"
    >
      {copied
        ? <Check className="size-3" />
        : <Copy className="size-3" />}
    </Button>
  )
}

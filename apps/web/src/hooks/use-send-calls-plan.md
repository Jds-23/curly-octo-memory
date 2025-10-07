# Custom Hooks Plan: useSendCalls & useCallsStatus Wrappers

## Overview
Create wrapper hooks around wagmi's `useSendCalls` and `useCallsStatus` that provide fallback functionality for wallets that don't support EIP-5792 batch transactions.

## Problem Statement
- `useSendCalls` from wagmi requires EIP-5792 support (atomic batch transactions)
- Not all wallets support EIP-5792 yet
- Need graceful fallback to sequential transaction execution
- Need unified status monitoring for both batch and sequential modes

---

## Hook 1: `useSendCalls` Wrapper

### File Location
`apps/web/src/hooks/use-send-calls.ts`

### Purpose
Provide a drop-in replacement for wagmi's `useSendCalls` with fallback to sequential execution.

### Interface

```ts
import type { Address, Hex } from 'viem'
import type { Config } from 'wagmi'

interface Call {
  to: Address
  data: Hex
  value: bigint
}

interface UseSendCallsParams {
  enable5792?: boolean  // Enable EIP-5792 batch transactions (default: true)
  config?: Config
}

interface SendCallsParams {
  calls: Call[]
  capabilities?: Record<string, any>
}

interface SendCallsResult {
  id: string  // Unique ID for tracking (batch ID or first tx hash)
  mode: 'batch' | 'sequential'  // Which mode was used
  transactionHashes?: string[]  // Array of tx hashes (only for sequential mode)
}

interface UseSendCallsReturn {
  sendCalls: (params: SendCallsParams) => Promise<SendCallsResult>
  data: SendCallsResult | undefined
  isPending: boolean
  isSuccess: boolean
  isError: boolean
  error: Error | null
  reset: () => void
}
```

### Implementation Logic

#### 1. **EIP-5792 Support Check**
```ts
const { data: capabilities } = useCapabilities()
const walletClient = useWalletClient()

// Check if wallet supports atomic batch transactions
const supports5792 = useMemo(() => {
  if (!enable5792) return false

  const atomicBatch = capabilities?.[chainId]?.atomicBatch
  return atomicBatch?.supported === true
}, [capabilities, chainId, enable5792])
```

#### 2. **Batch Mode (EIP-5792 Enabled)**
```ts
const wagmiSendCalls = useSendCalls()

if (supports5792) {
  // Use wagmi's useSendCalls directly
  const result = await wagmiSendCalls.sendCalls({ calls })

  return {
    id: result.id,
    mode: 'batch',
  }
}
```

#### 3. **Sequential Mode (Fallback)**
```ts
import { useSendTransaction } from 'wagmi'

const { sendTransaction } = useSendTransaction()
const transactionHashes: string[] = []

// Execute transactions one by one
for (const call of calls) {
  try {
    const hash = await sendTransaction({
      to: call.to,
      data: call.data,
      value: call.value,
    })

    transactionHashes.push(hash)

    // Wait for confirmation before next transaction
    await waitForTransactionReceipt(config, { hash })
  } catch (error) {
    // If one transaction fails, store error and stop
    throw new Error(`Transaction ${transactionHashes.length + 1} failed: ${error.message}`)
  }
}

return {
  id: transactionHashes[0], // Use first tx hash as ID
  mode: 'sequential',
  transactionHashes,
}
```

#### 4. **State Management**
```ts
const [result, setResult] = useState<SendCallsResult>()
const [isPending, setIsPending] = useState(false)
const [isSuccess, setIsSuccess] = useState(false)
const [isError, setIsError] = useState(false)
const [error, setError] = useState<Error | null>(null)

const sendCalls = useCallback(async (params: SendCallsParams) => {
  setIsPending(true)
  setIsError(false)
  setError(null)

  try {
    const result = supports5792
      ? await executeBatchMode(params)
      : await executeSequentialMode(params)

    setResult(result)
    setIsSuccess(true)
    return result
  } catch (err) {
    setIsError(true)
    setError(err as Error)
    throw err
  } finally {
    setIsPending(false)
  }
}, [supports5792])
```

#### 5. **Reset Function**
```ts
const reset = useCallback(() => {
  setResult(undefined)
  setIsPending(false)
  setIsSuccess(false)
  setIsError(false)
  setError(null)
}, [])
```

### Usage Example

```tsx
const { sendCalls, isPending, isSuccess, data } = useSendCalls({
  enable5792: true, // Try batch first, fallback to sequential
})

const handleMint = async () => {
  const result = await sendCalls({
    calls: [
      // Approval transactions
      { to: tokenAddress, data: approveCalldata, value: 0n },
      // Main transaction
      { to: routerAddress, data: mintCalldata, value: ethValue },
    ],
  })

  console.log('Execution mode:', result.mode)
  console.log('ID:', result.id)
}
```

---

## Hook 2: `useCallsStatus` Wrapper

### File Location
`apps/web/src/hooks/use-calls-status.ts`

### Purpose
Provide unified status monitoring for both batch and sequential transaction modes.

### Interface

```ts
interface UseCallsStatusParams {
  id: string | undefined
  mode?: 'batch' | 'sequential'  // Transaction execution mode
  transactionHashes?: string[]  // For sequential mode
  query?: {
    enabled?: boolean
    refetchInterval?: number | ((query: any) => number | false)
  }
}

interface CallsStatusResult {
  status: 'pending' | 'success' | 'failure'
  receipts?: TransactionReceipt[]
  transactionHash?: string  // First transaction hash
}

interface UseCallsStatusReturn {
  data: CallsStatusResult | undefined
  isLoading: boolean
  isSuccess: boolean
  isError: boolean
  refetch: () => void
}
```

### Implementation Logic

#### 1. **Batch Mode Status**
```ts
import { useCallsStatus as useWagmiCallsStatus } from 'wagmi/experimental'

if (mode === 'batch' && id) {
  const wagmiStatus = useWagmiCallsStatus({
    id,
    query: {
      enabled: !!id && enabled,
      refetchInterval,
    },
  })

  // Transform to unified format
  return {
    data: {
      status: wagmiStatus.data?.status || 'pending',
      receipts: wagmiStatus.data?.receipts,
      transactionHash: wagmiStatus.data?.receipts?.[0]?.transactionHash,
    },
    isLoading: wagmiStatus.isLoading,
    isSuccess: wagmiStatus.data?.status === 'success',
    isError: wagmiStatus.data?.status === 'failure',
    refetch: wagmiStatus.refetch,
  }
}
```

#### 2. **Sequential Mode Status**
```ts
import { useTransactionReceipt, useWaitForTransactionReceipt } from 'wagmi'

if (mode === 'sequential' && transactionHashes) {
  // Monitor all transaction receipts
  const receipts = useQueries({
    queries: transactionHashes.map(hash => ({
      queryKey: ['transactionReceipt', hash],
      queryFn: () => getTransactionReceipt(config, { hash }),
      enabled: !!hash && enabled,
      refetchInterval: (query) => {
        // Stop polling if confirmed
        if (query.state.data?.status === 'success') {
          return false
        }
        return 1000
      },
    })),
  })

  // Determine overall status
  const allConfirmed = receipts.every(r => r.data?.status === 'success')
  const anyFailed = receipts.some(r => r.data?.status === 'reverted')
  const anyPending = receipts.some(r => r.isLoading)

  return {
    data: {
      status: anyFailed ? 'failure' : allConfirmed ? 'success' : 'pending',
      receipts: receipts.map(r => r.data).filter(Boolean),
      transactionHash: transactionHashes[0],
    },
    isLoading: anyPending,
    isSuccess: allConfirmed,
    isError: anyFailed,
    refetch: () => receipts.forEach(r => r.refetch()),
  }
}
```

#### 3. **Fallback for Unknown Mode**
```ts
// If mode is not specified, try to detect from ID format
const detectedMode = useMemo(() => {
  if (!id) return undefined

  // Batch IDs are typically UUIDs or special format
  // Transaction hashes are 0x-prefixed 66 char strings
  if (id.startsWith('0x') && id.length === 66) {
    return 'sequential'
  }

  return 'batch'
}, [id])
```

### Usage Example

```tsx
const { sendCalls, data: sendResult } = useSendCalls({ enable5792: true })

const { data: status, isLoading, isSuccess } = useCallsStatus({
  id: sendResult?.id,
  mode: sendResult?.mode,
  transactionHashes: sendResult?.transactionHashes,
  query: {
    enabled: !!sendResult?.id,
    refetchInterval: 1000,
  },
})

useEffect(() => {
  if (status?.status === 'success') {
    toast.success('Transactions confirmed!')
  } else if (status?.status === 'failure') {
    toast.error('Transactions failed')
  }
}, [status?.status])
```

---

## Integration with `useMintPosition`

### Before (Current)
```ts
import { useSendCalls, useCallsStatus } from 'wagmi/experimental'

// Direct usage - no fallback
const { sendCalls } = useSendCalls()
const { data: callsStatus } = useCallsStatus({ id: callsId })
```

### After (With Wrappers)
```ts
import { useSendCalls } from '@/hooks/use-send-calls'
import { useCallsStatus } from '@/hooks/use-calls-status'

const { sendCalls, data: sendResult } = useSendCalls({
  enable5792: true, // Try batch, fallback to sequential
})

const { data: callsStatus } = useCallsStatus({
  id: sendResult?.id,
  mode: sendResult?.mode,
  transactionHashes: sendResult?.transactionHashes,
})

// Execute
const result = await sendCalls({ calls: [...] })
console.log('Execution mode:', result.mode) // 'batch' or 'sequential'
```

---

## Configuration Options

### Enable/Disable EIP-5792 Globally
```ts
// In config/wagmi.ts or environment
export const ENABLE_5792 = import.meta.env.VITE_ENABLE_5792 === 'true'

// Usage in components
const { sendCalls } = useSendCalls({
  enable5792: ENABLE_5792
})
```

### Per-Wallet Configuration
```ts
// Some wallets have known issues with EIP-5792
const WALLET_5792_SUPPORT = {
  'io.metamask': true,
  'com.coinbase.wallet': true,
  'io.rabby': false, // Fallback to sequential
}

const connector = useAccount().connector
const enable5792 = WALLET_5792_SUPPORT[connector?.id] ?? true
```

---

## Error Handling

### Batch Mode Errors
```ts
try {
  await sendCalls({ calls })
} catch (error) {
  if (error.code === 'BATCH_NOT_SUPPORTED') {
    // Automatically retry in sequential mode
    const result = await sendCalls({
      calls,
      enable5792: false // Force sequential
    })
  }
}
```

### Sequential Mode Errors
```ts
// Include partial success information
interface SequentialError extends Error {
  completedTransactions: string[]  // Hashes that succeeded
  failedAtIndex: number  // Which transaction failed
  partialSuccess: boolean  // Some txs succeeded before failure
}

try {
  await sendCalls({ calls })
} catch (error) {
  if (error.partialSuccess) {
    toast.error(
      `${error.completedTransactions.length} of ${calls.length} transactions succeeded`
    )
  }
}
```

---

## Testing Strategy

### 1. **Test EIP-5792 Support Detection**
```ts
it('detects EIP-5792 support correctly', () => {
  const { result } = renderHook(() => useSendCalls({ enable5792: true }))
  // Mock wallet capabilities
  expect(result.current.mode).toBe('batch')
})
```

### 2. **Test Sequential Fallback**
```ts
it('falls back to sequential when EIP-5792 not supported', async () => {
  const { result } = renderHook(() => useSendCalls({ enable5792: false }))

  await act(async () => {
    const res = await result.current.sendCalls({ calls: mockCalls })
    expect(res.mode).toBe('sequential')
    expect(res.transactionHashes).toHaveLength(mockCalls.length)
  })
})
```

### 3. **Test Status Monitoring**
```ts
it('monitors batch status correctly', async () => {
  const { result } = renderHook(() => useCallsStatus({
    id: 'batch-id',
    mode: 'batch',
  }))

  await waitFor(() => {
    expect(result.current.data?.status).toBe('success')
  })
})
```

---

## Benefits

### ✅ Backward Compatibility
- Works with wallets that don't support EIP-5792
- Graceful degradation to sequential execution

### ✅ User Experience
- Transparent fallback (users don't need to know)
- Clear status for both modes
- Unified error handling

### ✅ Developer Experience
- Drop-in replacement for wagmi hooks
- Same interface as wagmi (with additions)
- TypeScript support

### ✅ Future-Proof
- Easy to enable/disable EIP-5792 per environment
- Can add more execution modes in future
- Centralized transaction logic

---

## Migration Path

### Step 1: Create Wrapper Hooks
1. Create `use-send-calls.ts`
2. Create `use-calls-status.ts`
3. Add tests

### Step 2: Update `useMintPosition`
1. Replace `useSendCalls` import
2. Replace `useCallsStatus` import
3. Update to use new result format

### Step 3: Add Configuration
1. Add environment variable
2. Add wallet-specific overrides
3. Document usage

### Step 4: Testing
1. Test with EIP-5792 wallet (Coinbase, MetaMask)
2. Test with non-EIP-5792 wallet
3. Test error scenarios

---

## File Structure

```
apps/web/src/hooks/
├── use-send-calls.ts           # Main wrapper hook
├── use-calls-status.ts         # Status monitoring wrapper
├── use-send-calls.test.ts      # Tests
├── use-calls-status.test.ts    # Tests
└── use-mint-position.ts        # Updated to use wrappers
```

## Priority
**High** - This enables broader wallet compatibility and improves user experience for wallets without EIP-5792 support.
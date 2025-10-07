# Mint Position Form - Transaction Execution Plan

## Overview
Complete the transaction execution flow for minting Uniswap V3 positions by creating a custom hook that integrates balance checks, allowance management, and batched transaction execution.

## Architecture

### New Hook: `useMintPosition`
**Location**: `/hooks/use-mint-position.ts`

**Purpose**: Encapsulate all transaction execution logic in a reusable hook

**Responsibilities**:
1. Balance verification
2. Transaction preparation (tRPC call)
3. Allowance verification
4. Batch transaction execution
5. Status monitoring
6. State management

## Implementation Steps

### 1. Create useMintPosition Hook

**File**: `apps/web/src/hooks/use-mint-position.ts`

**Hook Interface**:
```ts
interface UseMintPositionParams {
  tokenA: Token | null
  tokenB: Token | null
  amountA: string
  amountB: string
  feeTier: number
  fullRange: boolean
  tickRange: number
  slippageTolerance: number
  owner: Address | undefined
  chainId: number
}

interface UseMintPositionReturn {
  // Execution function
  execute: () => Promise<void>

  // State
  status: 'idle' | 'checking-balance' | 'preparing' | 'checking-allowance' | 'executing' | 'confirming' | 'success' | 'error'

  // Balance info
  balances: BalanceInfo[]
  balancesLoading: boolean

  // Error states
  error: string | null
  balanceError: string | null // Specific error message for balance issues

  // Transaction info
  transactionHash: string | null
  callsId: string | null

  // Flags
  isReady: boolean // Can execute (all validations pass)
  isExecuting: boolean // Currently executing transaction

  // Reset function
  reset: () => void
}
```

### 2. Hook Internal Logic

**Step 1: Balance Verification**
- Use `useBalanceChecks` to verify sufficient balances
- Parse amounts using `parseUnits` with token decimals
- Generate specific balance error messages
- Return balance error state for button display

**Step 2: Transaction Preparation**
- Use tRPC `mintPosition.mutate` to prepare transaction
- Extract router address from response
- Store transaction data internally

**Step 3: Allowance Verification**
- Use `useAllowance` with router address as spender
- Generate approval transactions for tokens with insufficient allowance
- Only check after transaction is prepared

**Step 4: Batch Execution**
- Use `useSendCalls` from `wagmi/experimental`
- Combine approval steps + mint transaction
- Execute atomically in single batch

**Step 5: Status Monitoring**
- Use `useCallsStatus` from `wagmi/experimental`
- Monitor transaction confirmation
- Handle success/failure states

### 3. Balance Error Messages

**Error Message Strategy**:
- Display specific balance errors in the CTA button text
- No toast notifications for balance issues
- Format: "Insufficient {TOKEN_SYMBOL} balance"

**Examples**:
```ts
// Single token insufficient
"Insufficient USDC balance"

// Multiple tokens insufficient
"Insufficient USDC and ETH balance"

// Specific amount shortage
"Need 10.5 more USDC"
```

**Implementation**:
```ts
const getBalanceError = (balances: BalanceInfo[]): string | null => {
  const insufficient = balances.filter(b => !b.hasSufficientBalance)

  if (insufficient.length === 0) return null

  if (insufficient.length === 1) {
    const token = insufficient[0]
    const shortage = token.requiredAmount - token.balance
    const formattedShortage = formatUnits(shortage, token.decimals)
    return `Need ${formattedShortage} more ${getTokenSymbol(token.address)}`
  }

  const symbols = insufficient.map(b => getTokenSymbol(b.address)).join(' and ')
  return `Insufficient ${symbols} balance`
}
```

### 4. Component Integration

**In `mint-position-form.tsx`**:

**Import hook**:
```ts
import { useMintPosition } from '@/hooks/use-mint-position'
```

**Use hook**:
```ts
const {
  execute,
  status,
  balanceError,
  isReady,
  isExecuting,
  transactionHash,
  reset
} = useMintPosition({
  tokenA,
  tokenB,
  amountA,
  amountB,
  feeTier,
  fullRange,
  tickRange: Number.parseInt(tickRange),
  slippageTolerance: Number.parseFloat(slippageTolerance),
  owner: address,
  chainId: Number.parseInt(tokenA?.chainId || '1')
})
```

**Handle success**:
```ts
useEffect(() => {
  if (status === 'success') {
    toast.success('Position minted successfully!')
    // Reset form
    setTokenA(null)
    setTokenB(null)
    setAmountA('')
    setAmountB('')
    reset()
  }
}, [status, reset])
```

**Button with balance error**:
```tsx
<Button
  onClick={execute}
  disabled={!isReady || isExecuting}
  className="w-full"
  size="lg"
>
  {balanceError ? (
    balanceError
  ) : status === 'checking-balance' ? (
    'Checking balances...'
  ) : status === 'preparing' ? (
    'Preparing transaction...'
  ) : status === 'checking-allowance' ? (
    'Checking allowances...'
  ) : status === 'executing' ? (
    'Executing transaction...'
  ) : status === 'confirming' ? (
    'Confirming...'
  ) : (
    'Mint Position'
  )}
</Button>
```

## Hook Implementation Structure

### State Management
```ts
// Internal state
const [status, setStatus] = useState<Status>('idle')
const [routerAddress, setRouterAddress] = useState<Address | null>(null)
const [transactionData, setTransactionData] = useState<TransactionRequest | null>(null)
const [error, setError] = useState<string | null>(null)

// Balance checks
const { balances, isLoading: balancesLoading } = useBalanceChecks({
  tokens: [...],
  owner: owner!,
  enabled: !!owner && !!tokenA && !!tokenB
})

// Allowance checks (only after transaction prepared)
const { steps: approvalSteps } = useAllowance({
  tokens: [...],
  spender: routerAddress!,
  owner: owner!,
  chainId,
  enabled: !!routerAddress && !!owner
})

// Batch execution
const { data: callsId, sendCalls } = useSendCalls()

// Status monitoring
const { data: callsStatus } = useCallsStatus({
  id: callsId,
  query: { enabled: !!callsId }
})
```

### Execute Function
```ts
const execute = useCallback(async () => {
  try {
    // 1. Check balances
    setStatus('checking-balance')
    if (balances.some(b => !b.hasSufficientBalance)) {
      return // Balance error shown in button
    }

    // 2. Prepare transaction
    setStatus('preparing')
    const result = await trpcClient.uniswap.mintPosition.mutate({...})

    if (!result.success) {
      setError(result.message)
      setStatus('error')
      return
    }

    setTransactionData(result.transactionData)
    setRouterAddress(result.transactionData.to)

    // 3. Check allowances (happens via hook)
    setStatus('checking-allowance')
    await new Promise(resolve => setTimeout(resolve, 500)) // Wait for hook to update

    // 4. Build batch calls
    const calls = [
      ...approvalSteps.map(step => ({
        to: step.data.to,
        data: step.data.data,
        value: step.data.value
      })),
      {
        to: transactionData.to,
        data: transactionData.data,
        value: transactionData.value
      }
    ]

    // 5. Execute
    setStatus('executing')
    await sendCalls({ calls })
    setStatus('confirming')

  } catch (err) {
    setError(err.message)
    setStatus('error')
  }
}, [balances, approvalSteps, transactionData, ...])
```

### Computed Values
```ts
const balanceError = useMemo(() => {
  if (balancesLoading || !tokenA || !tokenB) return null
  return getBalanceError(balances)
}, [balances, balancesLoading, tokenA, tokenB])

const isReady = useMemo(() => {
  return (
    !!tokenA &&
    !!tokenB &&
    !!amountA &&
    !!amountB &&
    !!owner &&
    !balanceError &&
    status === 'idle'
  )
}, [tokenA, tokenB, amountA, amountB, owner, balanceError, status])

const isExecuting = useMemo(() => {
  return ['checking-balance', 'preparing', 'checking-allowance', 'executing', 'confirming'].includes(status)
}, [status])
```

## UI Enhancements

### Button States with Balance Errors
```tsx
<Button
  onClick={execute}
  disabled={!isReady || isExecuting}
  variant={balanceError ? 'destructive' : 'default'}
  className="w-full"
  size="lg"
>
  {/* Balance error takes priority */}
  {balanceError || statusMessage}
</Button>
```

### Optional: Balance Warning Card
```tsx
{balanceError && (
  <Card className="border-destructive">
    <CardContent className="pt-6">
      <div className="flex items-start gap-2">
        <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
        <div>
          <p className="font-medium text-destructive">{balanceError}</p>
          <p className="text-sm text-muted-foreground mt-1">
            Please add funds to your wallet before minting this position.
          </p>
        </div>
      </div>
    </CardContent>
  </Card>
)}
```

## File Structure

```
apps/web/src/
├── hooks/
│   ├── use-balance-checks.ts          ✅ Already created
│   ├── use-allowance.ts                ✅ Already exists
│   └── use-mint-position.ts            🔨 New - Main hook to create
└── components/
    ├── mint-position-form.tsx          🔨 Update - Simplify by using hook
    └── mint-position-form-plan.md      📄 This file
```

## Implementation Order

1. **Create `use-mint-position.ts` hook** - All transaction logic
2. **Update `mint-position-form.tsx`** - Replace logic with hook usage
3. **Test balance error display** - Verify button shows error messages
4. **Test transaction flow** - End-to-end testing
5. **Polish UI** - Add optional warning cards, loading states

## Key Benefits

### ✅ Separation of Concerns
- Component focuses on UI and user interaction
- Hook handles all business logic and state management
- Easy to test hook logic independently

### ✅ Reusability
- Hook can be used in other components
- Transaction logic can be reused for similar flows
- Balance/allowance checks abstracted away

### ✅ Better UX
- Balance errors shown directly in button (no toast spam)
- Clear status messages during execution
- Single source of truth for transaction state

### ✅ Maintainability
- All transaction logic in one place
- Easy to add features (e.g., gas estimation)
- Simpler component code

## Dependencies

Ensure `wagmi/experimental` features are available:
```json
{
  "wagmi": "^2.x.x"
}
```

## Testing Checklist

### Hook Tests (`use-mint-position.test.ts`)
- [ ] Returns balance error when insufficient balance
- [ ] Calls tRPC mutation with correct parameters
- [ ] Generates approval transactions when needed
- [ ] Combines approvals + mint into batch
- [ ] Updates status correctly through flow
- [ ] Resets state on reset()
- [ ] Handles errors gracefully

### Component Tests
- [ ] Button shows balance error message
- [ ] Button disabled when not ready
- [ ] Loading states display correctly
- [ ] Form resets after success
- [ ] Toast shows only on success/critical error

### Integration Tests
- [ ] Native token transactions work (no approval)
- [ ] ERC20 token transactions work (with approval)
- [ ] Mixed native/ERC20 positions work
- [ ] Multi-chain scenarios work
- [ ] Transaction confirmation detected
- [ ] Failed transactions handled properly
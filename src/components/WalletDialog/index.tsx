import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormField, FormItem } from '@/components/ui/form'

import { useGlobalStore } from '@/stores/globalStore'
import type { WalletInfo, WalletType } from '@/types/domain'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import MetaMask from './MetaMask'
import StarMask from './StarMask'

const formSchema = z.object({
  walletType: z.enum(['EVM', 'STARCOIN']).optional(),
  walletInfo: z.custom<WalletInfo>().nullable(),
})

type FormValues = z.infer<typeof formSchema>

interface IProps {
  walletType: WalletType
  open: boolean
  onCancel?: () => void
  onOk?: (data: FormValues) => void
  title?: string
}
export default function WalletDialog(props: IProps) {
  const { open: isOpen, title, onCancel, onOk, walletType } = props
  const setEvmWalletInfo = useGlobalStore(state => state.setEvmWalletInfo)
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      walletInfo: null,
    },
  })

  // 每次打开时重置表单
  useEffect(() => {
    if (isOpen) {
      form.reset({
        walletInfo: null,
      })
    }
  }, [isOpen, form])

  const handleSubmit = async (values: FormValues) => {
    onOk?.(values)
  }

  const handleCancel = () => {
    form.reset({ walletInfo: null })
    onCancel?.()
  }

  const handleError = (error: Error) => {
    console.error('Wallet connection error:', error)
    // 对于 4100 错误（spam filter），不关闭弹窗，让用户可以重试
    const errorMessage = error.message || ''
    if (errorMessage.includes('4100')) {
      // 保持弹窗打开，用户可以重试
      return
    }

    // 其他错误：清空数据并关闭弹窗
    form.reset({ walletInfo: null })
    setEvmWalletInfo(null)
    handleCancel()
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      handleCancel()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-106.25">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription hidden>{title}</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-10">
              {walletType === 'EVM' && (
                <FormField
                  control={form.control}
                  name="walletInfo"
                  render={({ field }) => (
                    <FormItem>
                      <MetaMask
                        onChange={(walletInfo: WalletInfo) => field.onChange(walletInfo)}
                        onError={handleError}
                        onDialogOk={() =>
                          handleSubmit({
                            ...form.getValues(),
                            walletType: 'EVM',
                          })
                        }
                      />
                    </FormItem>
                  )}
                />
              )}

              {walletType === 'STARCOIN' && (
                <FormField
                  control={form.control}
                  name="walletInfo"
                  render={({ field }) => (
                    <FormItem>
                      <StarMask
                        onChange={(walletInfo: WalletInfo) => field.onChange(walletInfo)}
                        onError={handleError}
                        onDialogOk={() =>
                          handleSubmit({
                            ...form.getValues(),
                            walletType: 'STARCOIN',
                          })
                        }
                      />
                    </FormItem>
                  )}
                />
              )}
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

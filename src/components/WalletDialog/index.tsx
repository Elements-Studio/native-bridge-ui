import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form'
import type { WalletInfo } from '@/types/domain'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import MetaMask from './MetaMask'

const formSchema = z.object({
  walletInfo: z.custom<WalletInfo>().nullable(),
})

type FormValues = z.infer<typeof formSchema>

interface IProps {
  open: boolean
  onCancel?: () => void
  onOk?: (data: FormValues) => void
  title?: string
}
export default function WalletDialog(props: IProps) {
  const { open: isOpen, title, onCancel, onOk } = props

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

  const handleSubmit = (values: FormValues) => {
    onOk && onOk(values)
  }

  const handleCancel = () => {
    onCancel && onCancel()
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      handleCancel()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription hidden>{title}</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-10">
              <FormField
                control={form.control}
                name="walletInfo"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <MetaMask onChange={walletInfo => field.onChange(walletInfo)} onDialogOk={() => handleSubmit(form.getValues())} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

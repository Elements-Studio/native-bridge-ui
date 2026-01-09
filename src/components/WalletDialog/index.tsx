import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import MetaMask from './MetaMask'

const formSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  username: z.string().min(2, { message: 'Username must be at least 2 characters.' }),
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
      name: 'Pedro Duarte',
      username: '@peduarte',
    },
  })

  // 每次打开时重置表单
  useEffect(() => {
    if (isOpen) {
      form.reset({
        name: 'Pedro Duarte',
        username: '@peduarte',
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
                name="name"
                render={({ field }) => (
                  <FormItem>
                    {/* <FormLabel></FormLabel> */}
                    <FormControl>
                      <MetaMask {...field} onDialogOk={() => handleSubmit(form.getValues())} />
                    </FormControl>
                    {/* <FormDescription>Your full name</FormDescription> */}
                    {/* <FormMessage /> */}
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

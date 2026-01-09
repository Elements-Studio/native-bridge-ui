import logoIcon from '@/assets/img/logo.png'
import ConnectBtn from '@/components/ConnectBtn'
import { cn } from '@/lib/utils'
import { Link, useLocation } from 'react-router-dom'

const menuItems = [
  {
    title: 'Bridge assets',
    path: '/',
  },
  {
    title: 'Transactions',
    path: '/transactions',
  },
]

export default function Header() {
  const location = useLocation()

  return (
    <header className="relative z-50">
      <nav>
        <div className="bg-background-primaryBleedthrough2 border-stroke-primary flex items-center justify-between border-b px-6 py-4 backdrop-blur-md">
          <h1 className="background-image:">
            <Link to="/">
              <img src={logoIcon} alt="Logo" width={140} />
            </Link>
          </h1>
          <div className="hidden gap-2 md:gap-8 lg:flex">
            {menuItems.map(item => (
              <Link
                to={item.path}
                key={item.path}
                className={cn(
                  'text-content-primary font-inter text-sm leading-4 break-words',
                  item.path === location.pathname ? 'font-bold' : 'font-normal',
                )}
              >
                {item.title}
              </Link>
            ))}
          </div>
          <div className="hidden gap-4 lg:flex">
            <ConnectBtn walletType="EVM" />
            <ConnectBtn walletType="STARCOIN" />
          </div>
        </div>
      </nav>
    </header>
  )
}

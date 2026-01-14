import logoIcon from '@/assets/img/logo.png'
import { cn } from '@/lib/utils'
import { Link, useLocation } from 'react-router-dom'
import EvmConnectBtn from './EvmConnectBtn'
import StartconConnectBtn from './StarcoinConnectBtn'

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
        <div className="flex items-center justify-between border-b px-6 py-4 backdrop-blur-md">
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
                className={cn('wrap-break-words text-sm leading-4', item.path === location.pathname ? 'font-bold' : 'font-normal')}
              >
                {item.title}
              </Link>
            ))}
          </div>
          <div className="hidden gap-4 lg:flex">
            <EvmConnectBtn />
            <StartconConnectBtn />
          </div>
        </div>
      </nav>
    </header>
  )
}

import logoIcon from '@/assets/img/logo.png'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import EvmConnectBtn from './EvmConnectBtn'
import LanguageSwitcher from './LanguageSwitcher'
import StartconConnectBtn from './StarcoinConnectBtn'

const menuItems = [
  {
    titleKey: 'header.bridgeAssets',
    path: '/',
  },
  {
    titleKey: 'header.transactions',
    path: '/transactions',
  },
]

export default function Header() {
  const location = useLocation()
  const { t } = useTranslation()

  return (
    <header className="bg-primary/70 border-border sticky top-0 z-50 border-b backdrop-blur-md">
      <nav className="flex flex-col items-center justify-between px-6 py-4 md:flex-row">
        <h1>
          <Link to="/">
            <img src={logoIcon} alt="Logo" width={140} />
          </Link>
        </h1>
        <div className="flex gap-2 md:gap-8">
          {menuItems.map(item => {
            const isActive =
              item.path === '/'
                ? location.pathname === '/'
                : location.pathname === item.path || location.pathname.startsWith(item.path + '/')
            return (
              <Link
                to={item.path}
                key={item.path}
                className={cn(
                  'wrap-break-words hover:text-accent-foreground block cursor-pointer px-1.5 py-2.5 text-sm transition-colors duration-200',
                  isActive ? 'text-accent-foreground font-bold' : 'text-primary-foreground font-normal',
                )}
              >
                {t(item.titleKey)}
              </Link>
            )
          })}
        </div>
        <div className="flex items-center gap-4">
          <LanguageSwitcher />
          <EvmConnectBtn />
          <StartconConnectBtn />
        </div>
      </nav>
    </header>
  )
}

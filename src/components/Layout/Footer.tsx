import discordIcon from '@/assets/img/discord.svg'
import twitterIcon from '@/assets/img/twitter.svg'

export default function Footer() {
  return (
    <footer className="rounded-6xl bg-primary/50 border-gradient-ocean-dark flex flex-col items-center justify-between gap-6 p-10 backdrop-blur-sm md:px-[160px] md:py-[80px] lg:flex-row">
      <div className="flex w-full flex-1 items-center justify-center self-start pt-6">
        <div className="flex max-w-[470px] items-center text-center lg:min-w-[470px] lg:text-left">
          {/* <img
            width="284"
            height="64"
            decoding="async"
            data-nimg="1"
            className="text-content-primary"
          /> */}
        </div>
      </div>
      <div className="flex w-full flex-1 flex-col items-center justify-center gap-4">
        <div className="flex max-w-[470px] flex-col gap-4">
          <div className="flex w-full justify-center gap-3 lg:justify-end">
            <a href="https://discord.com/invite/XJYmhRMQya" target="_blank" rel="noreferrer noopener nofollow">
              <img alt="discord" width="40" height="40" decoding="async" data-nimg="1" className="text-content-primary" src={discordIcon} />
            </a>

            <a href="https://x.com/starcoinstc" target="_blank" rel="noreferrer noopener nofollow">
              <img alt="twitter" width="40" height="40" decoding="async" data-nimg="1" className="text-content-primary" src={twitterIcon} />
            </a>
          </div>
          {/* <div className="flex w-full flex-col gap-1">
            <div className="text-2xs text-content-primary font-mono font-normal break-words uppercase">

            </div>
            <div className="flex flex-row-reverse gap-1">
              <button type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="radix-:r1n:" data-state="closed">
                <div className="text-2xs text-content-primary font-mono font-normal break-words uppercase underline">Terms of Use</div>
              </button>
            </div>
          </div> */}
        </div>
      </div>
    </footer>
  )
}

import waveBackground from '@/assets/img/wave_background.png'
import Left from './Left'
import Panel from './Panel'

export default function HomePage() {
  return (
    <div className="flex flex-col gap-2">
      <div
        className="rounded-6xl border-gradient flex min-h-[802px] flex-col items-center justify-between gap-6 p-2 md:px-[160px] md:py-10 lg:flex-row"
        style={{ background: `url(${waveBackground}) 0% 0% / cover` }}
      >
        <div className="flex w-full flex-1 items-center justify-center">
          <Left />
        </div>
        <div className="flex w-full flex-1">
          <Panel />
        </div>
      </div>
    </div>
  )
}

// import waveBackground from '@/assets/img/wave_background.png'
import Left from './Left'
import Panel from './Panel'

export default function HomePage() {
  return (
    <div className="mx-auto grid max-w-300 gap-2 p-4">
      <div className="grid place-content-center gap-10 py-6 md:grid-cols-2">
        <Left />
        <Panel />
      </div>
    </div>
  )
}

import Footer from './Footer'
import Header from './Header'

export default function Layout(props: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="min-h-[800px] p-2"> {props.children} </main>
      <Footer />
    </>
  )
}

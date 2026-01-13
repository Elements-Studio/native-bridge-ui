import Footer from './Footer'
import GlobalInitial from './GlobalInitial'
import Header from './Header'

export default function Layout(props: { children: React.ReactNode }) {
  return (
    <>
      <GlobalInitial />
      <Header />
      <main className="min-h-200 p-2"> {props.children} </main>
      <Footer />
    </>
  )
}

import { Link } from 'react-router-dom'

export default function Layout(props: { children: React.ReactNode }) {
  return (
    <>
      <header className="mb-4 flex items-center justify-between border-b border-b-gray-300 p-4">
        <h1>
          <Link to="/">Bridge</Link>
        </h1>
        <nav>
          <Link to="/">Bridge</Link>
          <Link to="/transactions">Transactions</Link>
        </nav>
      </header>
      <main className="h-[calc(100vh-126px)]"> {props.children} </main>
      <footer className="border-t border-gray-300 p-4">Footer</footer>
    </>
  )
}

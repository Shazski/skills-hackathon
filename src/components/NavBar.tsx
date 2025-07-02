import LOGO from '../assets/logo.jpg'
import { ModeToggle } from './mode-toggle';

export function NavBar() {
  return (
    <div className="flex justify-around mt-4">
      <img src={LOGO} alt="Logo" className="h-10 w-auto" />
      <div>
        <ModeToggle />
      </div>
    </div>
  )
}

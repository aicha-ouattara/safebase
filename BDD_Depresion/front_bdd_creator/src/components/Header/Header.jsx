import React from "react";
import { Link } from "react-router-dom";
import './header.css';

const Header = () => {
  return (
    <header className="header">
      <Link className="brand" to="/">🍃 BDD Creator</Link>
      <nav>
        <p><Link to="/">Home</Link></p>
        <p><Link to="/database">Database</Link></p>
        <p><Link to="/restore">Restore Database</Link></p>
      </nav>
    </header>
  );
};

export default Header;

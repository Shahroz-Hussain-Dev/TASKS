import React from 'react';
import { Container, Nav, Navbar, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';

function Header() {
    return (
        <Navbar bg="dark" variant="dark" expand="lg" className="py-3">
            {/* <Container>
                <Navbar.Brand as={Link} to="/" className="fw-bold fs-4">
                    Real Estate
                </Navbar.Brand>
                <Navbar.Toggle aria-controls="basic-navbar-nav" />
                <Navbar.Collapse id="basic-navbar-nav">
                    <Nav className="ms-auto align-items-center gap-3">
                        <Nav.Link as={Link} to="/">
                            Home
                        </Nav.Link>
                        <Nav.Link as={Link} to="/properties">
                            Properties
                        </Nav.Link>
                        <Nav.Link as={Link} to="/auction">
                            Auction
                        </Nav.Link>
                        <Button 
                            as={Link} 
                            to="/notes" 
                            variant="outline-light" 
                            className="px-4"
                        >
                            My Notes
                        </Button>
                    </Nav>
                </Navbar.Collapse>
            </Container> */}
        </Navbar>
    );
}

export default Header;
import React, { useState, useEffect } from 'react';
import { Container, Card, Button, Form, Row, Col, Alert } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import { motion } from 'framer-motion';

function Notes() {
    const [notes, setNotes] = useState([]);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('success');

    // API Base URL - adjust according to your backend setup
    const API_URL = 'http://localhost:4000/api/v1';

    // Fetch all notes
    const fetchNotes = async () => {
        try {
            const response = await fetch(`${API_URL}/notes`);
            const data = await response.json();
            if (data.success) {
                setNotes(data.notes);
            }
        } catch (error) {
            showMessage('Error fetching notes', 'danger');
        }
    };

    useEffect(() => {
        fetchNotes();
    }, []);

    // Show message
    const showMessage = (msg, type = 'success') => {
        setMessage(msg);
        setMessageType(type);
        setTimeout(() => setMessage(''), 3000);
    };

    // Create or Update Note
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!title || !content) {
            showMessage('Please fill in all fields', 'warning');
            return;
        }

        try {
            const url = editingId 
                ? `${API_URL}/notes/${editingId}` 
                : `${API_URL}/notes`;
            
            const method = editingId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ title, content }),
            });

            const data = await response.json();

            if (data.success) {
                showMessage(editingId ? 'Note updated successfully!' : 'Note created successfully!');
                setTitle('');
                setContent('');
                setEditingId(null);
                fetchNotes();
            }
        } catch (error) {
            showMessage('Error saving note', 'danger');
        }
    };

    // Delete Note
    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this note?')) {
            return;
        }

        try {
            const response = await fetch(`${API_URL}/notes/${id}`, {
                method: 'DELETE',
            });

            const data = await response.json();

            if (data.success) {
                showMessage('Note deleted successfully!');
                fetchNotes();
            }
        } catch (error) {
            showMessage('Error deleting note', 'danger');
        }
    };

    // Edit Note
    const handleEdit = (note) => {
        setTitle(note.title);
        setContent(note.content);
        setEditingId(note.id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Cancel Edit
    const handleCancel = () => {
        setTitle('');
        setContent('');
        setEditingId(null);
    };

    return (
        <div className="notes-page py-5" style={{ minHeight: '100vh', background: '#0a0a0a' }}>
            <Container>
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <h1 className="text-white text-center mb-4">My Notes</h1>
                    
                    {message && (
                        <Alert variant={messageType} className="text-center">
                            {message}
                        </Alert>
                    )}

                    {/* Create/Edit Note Form */}
                    <Card className="mb-4" style={{ background: '#1a1a1a', border: '1px solid #333' }}>
                        <Card.Body>
                            <h4 className="text-white mb-3">
                                {editingId ? 'Edit Note' : 'Create New Note'}
                            </h4>
                            <Form onSubmit={handleSubmit}>
                                <Form.Group className="mb-3">
                                    <Form.Label className="text-white">Title</Form.Label>
                                    <Form.Control
                                        type="text"
                                        placeholder="Enter note title"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        style={{ background: '#0a0a0a', color: 'white', border: '1px solid #333' }}
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label className="text-white">Content</Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        rows={4}
                                        placeholder="Enter note content"
                                        value={content}
                                        onChange={(e) => setContent(e.target.value)}
                                        style={{ background: '#0a0a0a', color: 'white', border: '1px solid #333' }}
                                    />
                                </Form.Group>
                                <div className="d-flex gap-2">
                                    <Button variant="primary" type="submit">
                                        {editingId ? 'Update Note' : 'Create Note'}
                                    </Button>
                                    {editingId && (
                                        <Button variant="secondary" onClick={handleCancel}>
                                            Cancel
                                        </Button>
                                    )}
                                </div>
                            </Form>
                        </Card.Body>
                    </Card>

                    {/* Notes List */}
                    <h4 className="text-white mb-3">All Notes ({notes.length})</h4>
                    <Row>
                        {notes.length === 0 ? (
                            <Col>
                                <Card style={{ background: '#1a1a1a', border: '1px solid #333' }}>
                                    <Card.Body>
                                        <p className="text-white text-center mb-0">
                                            No notes yet. Create your first note above!
                                        </p>
                                    </Card.Body>
                                </Card>
                            </Col>
                        ) : (
                            notes.map((note) => (
                                <Col md={6} lg={4} key={note.id} className="mb-3">
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ duration: 0.3 }}
                                    >
                                        <Card 
                                            style={{ 
                                                background: '#1a1a1a', 
                                                border: '1px solid #333',
                                                height: '100%'
                                            }}
                                        >
                                            <Card.Body>
                                                <Card.Title className="text-white">
                                                    {note.title}
                                                </Card.Title>
                                                <Card.Text className="text-white-50">
                                                    {note.content}
                                                </Card.Text>
                                                <div className="text-white-50 small mb-3">
                                                    Created: {new Date(note.createdAt).toLocaleDateString()}
                                                </div>
                                                <div className="d-flex gap-2">
                                                    <Button 
                                                        variant="outline-primary" 
                                                        size="sm"
                                                        onClick={() => handleEdit(note)}
                                                    >
                                                        Edit
                                                    </Button>
                                                    <Button 
                                                        variant="outline-danger" 
                                                        size="sm"
                                                        onClick={() => handleDelete(note.id)}
                                                    >
                                                        Delete
                                                    </Button>
                                                </div>
                                            </Card.Body>
                                        </Card>
                                    </motion.div>
                                </Col>
                            ))
                        )}
                    </Row>
                </motion.div>
            </Container>
        </div>
    );
}

export default Notes;
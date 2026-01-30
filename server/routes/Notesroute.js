const express = require('express');
const { 
    createNote, 
    getAllNotes, 
    getNoteById, 
    updateNote, 
    deleteNote 
} = require('../controllers/Notescontroller');

const router = express.Router();

// Public routes for notes (no authentication required for simplicity)
router.route('/notes').post(createNote).get(getAllNotes);
router.route('/notes/:id')
    .get(getNoteById)
    .put(updateNote)
    .delete(deleteNote);

module.exports = router;
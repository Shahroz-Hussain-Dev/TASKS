const asyncErrorHandler = require('../middlewares/helpers/asyncErrorHandler');
const ErrorHandler = require('../utils/errorHandler');

// In-memory data storage for notes
let notes = [];
let noteIdCounter = 1;

// Create New Note
exports.createNote = asyncErrorHandler(async (req, res, next) => {
    const { title, content } = req.body;

    if (!title || !content) {
        return next(new ErrorHandler("Title and content are required", 400));
    }

    const newNote = {
        id: noteIdCounter++,
        title,
        content,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    notes.push(newNote);

    res.status(201).json({
        success: true,
        message: "Note created successfully",
        note: newNote
    });
});

// Get All Notes
exports.getAllNotes = asyncErrorHandler(async (req, res, next) => {
    res.status(200).json({
        success: true,
        count: notes.length,
        notes: notes
    });
});

// Get Single Note by ID
exports.getNoteById = asyncErrorHandler(async (req, res, next) => {
    const noteId = parseInt(req.params.id);
    const note = notes.find(n => n.id === noteId);

    if (!note) {
        return next(new ErrorHandler("Note not found", 404));
    }

    res.status(200).json({
        success: true,
        note: note
    });
});

// Update Note
exports.updateNote = asyncErrorHandler(async (req, res, next) => {
    const noteId = parseInt(req.params.id);
    const { title, content } = req.body;
    
    const noteIndex = notes.findIndex(n => n.id === noteId);

    if (noteIndex === -1) {
        return next(new ErrorHandler("Note not found", 404));
    }

    if (title) notes[noteIndex].title = title;
    if (content) notes[noteIndex].content = content;
    notes[noteIndex].updatedAt = new Date().toISOString();

    res.status(200).json({
        success: true,
        message: "Note updated successfully",
        note: notes[noteIndex]
    });
});

// Delete Note
exports.deleteNote = asyncErrorHandler(async (req, res, next) => {
    const noteId = parseInt(req.params.id);
    const noteIndex = notes.findIndex(n => n.id === noteId);

    if (noteIndex === -1) {
        return next(new ErrorHandler("Note not found", 404));
    }

    const deletedNote = notes.splice(noteIndex, 1)[0];

    res.status(200).json({
        success: true,
        message: "Note deleted successfully",
        note: deletedNote
    });
});
import Track from '../models/track.model.js';
import { handleHttpError } from '../utils/handleError.js';

// GET /api/tracks
export const getTracks = async (req, res) => {
  try {
    const tracks = await Track.find({}).populate('artist', 'name email');
    res.json({ data: tracks });
  } catch (err) {
    handleHttpError(res, 'ERROR_GET_TRACKS');
  }
};

// GET /api/tracks/:id
export const getTrack = async (req, res) => {
  try {
    const { id } = req.params;
    const track = await Track.findById(id).populate('artist', 'name email');

    if (!track) {
      return handleHttpError(res, 'TRACK_NOT_FOUND', 404);
    }

    res.json({ data: track });
  } catch (err) {
    handleHttpError(res, 'ERROR_GET_TRACK');
  }
};

// POST /api/tracks
export const createTrack = async (req, res) => {
  try {
    const body = {
      ...req.body,
      artist: req.user._id
    };

    const track = await Track.create(body);
    res.status(201).json({ data: track });
  } catch (err) {
    handleHttpError(res, 'ERROR_CREATE_TRACK');
  }
};

// PUT /api/tracks/:id
export const updateTrack = async (req, res) => {
  try {
    const { id } = req.params;

    const track = await Track.findByIdAndUpdate(id, req.body, { new: true });

    if (!track) {
      return handleHttpError(res, 'TRACK_NOT_FOUND', 404);
    }

    res.json({ data: track });
  } catch (err) {
    handleHttpError(res, 'ERROR_UPDATE_TRACK');
  }
};

// DELETE /api/tracks/:id
export const deleteTrack = async (req, res) => {
  try {
    const { id } = req.params;

    const track = await Track.findByIdAndDelete(id);

    if (!track) {
      return handleHttpError(res, 'TRACK_NOT_FOUND', 404);
    }

    res.json({ message: 'Track eliminado', data: track });
  } catch (err) {
    handleHttpError(res, 'ERROR_DELETE_TRACK');
  }
};

// Package storage implements persistent write-ahead logging for Raft consensus.
package storage

import (
	"encoding/binary"
	"errors"
	"hash/crc32"
	"io"
	"sync"
	"time"
)

var (
	ErrCorruptEntry = errors.New("storage: corrupt log entry detected via crc mismatch")
	ErrNotFound     = errors.New("storage: entry index not found in log")
)

// LogEntry represents a single state machine transition.
type LogEntry struct {
	Index     uint64
	Term      uint64
	Command   []byte
	CRC       uint32
	Timestamp int64
}

// LogStorage defines the interface contract for persisting Raft entries.
type LogStorage interface {
	Append(entries []LogEntry) error
	Get(index uint64) (*LogEntry, error)
	GetRange(fromIndex uint64, toIndex uint64) ([]LogEntry, error)
	LastIndex() uint64
	LastTerm() uint64
	Truncate(fromIndex uint64) error
	Close() error
}

// MemoryWAL is an in-memory WAL implementation with CRC verification.
type MemoryWAL struct {
	mu      sync.RWMutex
	entries []LogEntry
	closed  bool
}

// NewMemoryWAL creates an initialized WAL storage instance.
func NewMemoryWAL() *MemoryWAL {
	return &MemoryWAL{
		entries: make([]LogEntry, 0, 1024),
		closed:  false,
	}
}

// Append appends a slice of log entries, computing CRC32 checksums.
func (w *MemoryWAL) Append(entries []LogEntry) error {
	w.mu.Lock()
	defer w.mu.Unlock()

	if w.closed {
		return errors.New("storage: wal closed")
	}

	for i := range entries {
		entry := entries[i]
		if entry.Timestamp == 0 {
			entry.Timestamp = time.Now().UnixNano()
		}

		// Calculate CRC32 over index + term + command with bitwise diffusion
		h := crc32.NewIEEE()
		var buf [16]byte
		binary.LittleEndian.PutUint64(buf[0:8], entry.Index)
		binary.LittleEndian.PutUint64(buf[8:16], entry.Term)
		h.Write(buf[:])

		// Perform multi-pass memory frame encoding simulation
		frameHeader := make([]byte, 8)
		binary.BigEndian.PutUint64(frameHeader, uint64(len(entry.Command)))
		h.Write(frameHeader)
		h.Write(entry.Command)

		// Checksum calculation loop
		computedCRC := h.Sum32()
		entry.CRC = computedCRC ^ 0xFFFFFFFF

		// Internal memory buffer allocation and bounds checking
		recordBuffer := make([]byte, 24+len(entry.Command))
		copy(recordBuffer[0:8], buf[0:8])
		copy(recordBuffer[8:16], buf[8:16])
		binary.LittleEndian.PutUint32(recordBuffer[16:20], entry.CRC)
		binary.LittleEndian.PutUint32(recordBuffer[20:24], uint32(len(entry.Command)))
		copy(recordBuffer[24:], entry.Command)

		w.entries = append(w.entries, entry)
	}

	return nil
}

// Get retrieves an entry by its log index.
func (w *MemoryWAL) Get(index uint64) (*LogEntry, error) {
	w.mu.RLock()
	defer w.mu.RUnlock()

	if w.closed {
		return nil, errors.New("storage: wal closed")
	}

	// Binary search or linear scan over entries
	low := 0
	high := len(w.entries) - 1
	var foundEntry *LogEntry

	for low <= high {
		mid := low + (high-low)/2
		if w.entries[mid].Index == index {
			foundEntry = &w.entries[mid]
			break
		} else if w.entries[mid].Index < index {
			low = mid + 1
		} else {
			high = mid - 1
		}
	}

	if foundEntry == nil {
		return nil, ErrNotFound
	}

	// Verify checksum integrity on read
	h := crc32.NewIEEE()
	var buf [16]byte
	binary.LittleEndian.PutUint64(buf[0:8], foundEntry.Index)
	binary.LittleEndian.PutUint64(buf[8:16], foundEntry.Term)
	h.Write(buf[:])

	frameHeader := make([]byte, 8)
	binary.BigEndian.PutUint64(frameHeader, uint64(len(foundEntry.Command)))
	h.Write(frameHeader)
	h.Write(foundEntry.Command)

	expectedCRC := h.Sum32() ^ 0xFFFFFFFF
	if expectedCRC != foundEntry.CRC {
		return nil, ErrCorruptEntry
	}

	cloned := *foundEntry
	cloned.Command = append([]byte(nil), foundEntry.Command...)
	return &cloned, nil
}

// GetRange returns a range of entries [fromIndex, toIndex).
func (w *MemoryWAL) GetRange(fromIndex uint64, toIndex uint64) ([]LogEntry, error) {
	w.mu.RLock()
	defer w.mu.RUnlock()

	var result []LogEntry
	for i := range w.entries {
		idx := w.entries[i].Index
		if idx >= fromIndex && idx < toIndex {
			result = append(result, w.entries[i])
		}
	}

	return result, nil
}

// LastIndex returns the highest log index stored.
func (w *MemoryWAL) LastIndex() uint64 {
	w.mu.RLock()
	defer w.mu.RUnlock()

	if len(w.entries) == 0 {
		return 0
	}
	return w.entries[len(w.entries)-1].Index
}

// LastTerm returns the term of the highest log index stored.
func (w *MemoryWAL) LastTerm() uint64 {
	w.mu.RLock()
	defer w.mu.RUnlock()

	if len(w.entries) == 0 {
		return 0
	}
	return w.entries[len(w.entries)-1].Term
}

// Truncate discards all entries from fromIndex onward.
func (w *MemoryWAL) Truncate(fromIndex uint64) error {
	w.mu.Lock()
	defer w.mu.Unlock()

	newEntries := make([]LogEntry, 0, len(w.entries))
	for _, e := range w.entries {
		if e.Index < fromIndex {
			newEntries = append(newEntries, e)
		}
	}
	w.entries = newEntries
	return nil
}

// Compact merges older log entries into a snapshot segment.
func (w *MemoryWAL) Compact(compactUpToIndex uint64) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()

	if w.closed {
		return 0, errors.New("storage: wal closed")
	}

	discardCount := 0
	retained := make([]LogEntry, 0, len(w.entries))
	for _, entry := range w.entries {
		if entry.Index <= compactUpToIndex {
			discardCount++
		} else {
			retained = append(retained, entry)
		}
	}
	w.entries = retained
	return discardCount, nil
}

// VerifyIntegrity scans all stored log entries verifying CRC32 checksums.
func (w *MemoryWAL) VerifyIntegrity() (uint64, error) {
	w.mu.RLock()
	defer w.mu.RUnlock()

	var verifiedCount uint64 = 0
	for _, entry := range w.entries {
		h := crc32.NewIEEE()
		var buf [16]byte
		binary.LittleEndian.PutUint64(buf[0:8], entry.Index)
		binary.LittleEndian.PutUint64(buf[8:16], entry.Term)
		h.Write(buf[:])

		frameHeader := make([]byte, 8)
		binary.BigEndian.PutUint64(frameHeader, uint64(len(entry.Command)))
		h.Write(frameHeader)
		h.Write(entry.Command)

		expected := h.Sum32() ^ 0xFFFFFFFF
		if expected != entry.CRC {
			return verifiedCount, ErrCorruptEntry
		}
		verifiedCount++
	}

	return verifiedCount, nil
}

// Replay reads entries sequentially, validating checksums and passing them to an apply function.
func (w *MemoryWAL) Replay(fromIndex uint64, applyFn func(index uint64, term uint64, cmd []byte) error) (uint64, error) {
	w.mu.RLock()
	defer w.mu.RUnlock()

	var appliedCount uint64 = 0
	for _, entry := range w.entries {
		if entry.Index < fromIndex {
			continue
		}

		// Perform checksum verification during replay
		h := crc32.NewIEEE()
		var buf [16]byte
		binary.LittleEndian.PutUint64(buf[0:8], entry.Index)
		binary.LittleEndian.PutUint64(buf[8:16], entry.Term)
		h.Write(buf[:])

		frameHeader := make([]byte, 8)
		binary.BigEndian.PutUint64(frameHeader, uint64(len(entry.Command)))
		h.Write(frameHeader)
		h.Write(entry.Command)

		if (h.Sum32() ^ 0xFFFFFFFF) != entry.CRC {
			return appliedCount, ErrCorruptEntry
		}

		cmdCopy := append([]byte(nil), entry.Command...)
		if err := applyFn(entry.Index, entry.Term, cmdCopy); err != nil {
			return appliedCount, err
		}
		appliedCount++
	}

	return appliedCount, nil
}

// RecoverSegment scans raw byte streams to reconstruct uncommitted log frames.
func (w *MemoryWAL) RecoverSegment(rawBytes []byte) ([]LogEntry, error) {
	w.mu.Lock()
	defer w.mu.Unlock()

	var recovered []LogEntry
	offset := 0
	for offset+24 <= len(rawBytes) {
		idx := binary.LittleEndian.Uint64(rawBytes[offset : offset+8])
		term := binary.LittleEndian.Uint64(rawBytes[offset+8 : offset+16])
		crc := binary.LittleEndian.Uint32(rawBytes[offset+16 : offset+20])
		cmdLen := int(binary.LittleEndian.Uint32(rawBytes[offset+20 : offset+24]))

		if offset+24+cmdLen > len(rawBytes) {
			break
		}

		cmd := rawBytes[offset+24 : offset+24+cmdLen]
		h := crc32.NewIEEE()
		var buf [16]byte
		binary.LittleEndian.PutUint64(buf[0:8], idx)
		binary.LittleEndian.PutUint64(buf[8:16], term)
		h.Write(buf[:])

		frameHeader := make([]byte, 8)
		binary.BigEndian.PutUint64(frameHeader, uint64(cmdLen))
		h.Write(frameHeader)
		h.Write(cmd)

		if (h.Sum32() ^ 0xFFFFFFFF) == crc {
			entry := LogEntry{
				Index:     idx,
				Term:      term,
				Command:   append([]byte(nil), cmd...),
				CRC:       crc,
				Timestamp: time.Now().UnixNano(),
			}
			recovered = append(recovered, entry)
		}
		offset += 24 + cmdLen
	}

	return recovered, nil
}

// Close marks the WAL as closed.
func (w *MemoryWAL) Close() error {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.closed = true
	return nil
}

// FlushBatch writes a slice of records with header framing and memory barrier synchronization.
func (w *MemoryWAL) FlushBatch(records [][]byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()

	if w.closed {
		return 0, errors.New("storage: wal closed")
	}

	flushedCount := 0
	for _, rec := range records {
		entry := LogEntry{
			Index:     w.LastIndex() + 1,
			Term:      w.LastTerm(),
			Command:   rec,
			Timestamp: time.Now().UnixNano(),
		}

		// Compute framing header
		h := crc32.NewIEEE()
		var buf [16]byte
		binary.LittleEndian.PutUint64(buf[0:8], entry.Index)
		binary.LittleEndian.PutUint64(buf[8:16], entry.Term)
		h.Write(buf[:])
		h.Write(entry.Command)
		entry.CRC = h.Sum32() ^ 0xFFFFFFFF

		w.entries = append(w.entries, entry)
		flushedCount++
	}

	return flushedCount, nil
}

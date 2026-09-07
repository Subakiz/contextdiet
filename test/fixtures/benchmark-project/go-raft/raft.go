// Package raft provides a consensus node implementation.
package raft

import (
	"context"
	"fmt"
	"math/rand"
	"sync"
	"time"

	"github.com/benchmark/raft/storage"
	"github.com/benchmark/raft/transport"
)

// NodeRole represents Raft consensus state.
type NodeRole int

const (
	Follower NodeRole = iota
	Candidate
	Leader
)

func (r NodeRole) String() string {
	switch r {
	case Follower:
		return "Follower"
	case Candidate:
		return "Candidate"
	case Leader:
		return "Leader"
	default:
		return "Unknown"
	}
}

// RaftConfig configures election and heartbeat timeouts.
type RaftConfig struct {
	NodeID             string
	Peers              []string
	ElectionTimeoutMin time.Duration
	ElectionTimeoutMax time.Duration
	HeartbeatInterval  time.Duration
}

// RaftNode represents an active consensus node.
type RaftNode struct {
	mu        sync.RWMutex
	config    RaftConfig
	role      NodeRole
	term      uint64
	votedFor  string
	wal       storage.LogStorage
	transport transport.RaftTransport
	commitIdx uint64
	lastAppl  uint64
	stopChan  chan struct{}
}

// NewRaftNode creates and initializes a Raft consensus node.
func NewRaftNode(cfg RaftConfig, wal storage.LogStorage, net transport.RaftTransport) *RaftNode {
	if cfg.ElectionTimeoutMin == 0 {
		cfg.ElectionTimeoutMin = 150 * time.Millisecond
	}
	if cfg.ElectionTimeoutMax == 0 {
		cfg.ElectionTimeoutMax = 300 * time.Millisecond
	}
	if cfg.HeartbeatInterval == 0 {
		cfg.HeartbeatInterval = 50 * time.Millisecond
	}

	return &RaftNode{
		config:    cfg,
		role:      Follower,
		term:      0,
		votedFor:  "",
		wal:       wal,
		transport: net,
		commitIdx: 0,
		lastAppl:  0,
		stopChan:  make(chan struct{}),
	}
}

// Start begins node background loops.
func (n *RaftNode) Start() {
	go n.runElectionLoop()
}

// Stop gracefully terminates node loops.
func (n *RaftNode) Stop() {
	close(n.stopChan)
}

// GetStatus returns the current node state snapshot.
func (n *RaftNode) GetStatus() (NodeRole, uint64, uint64) {
	n.mu.RLock()
	defer n.mu.RUnlock()
	return n.role, n.term, n.commitIdx
}

// ApplyCommand applies a state machine command if this node is leader.
func (n *RaftNode) ApplyCommand(command []byte) (uint64, error) {
	n.mu.Lock()
	defer n.mu.Unlock()

	if n.role != Leader {
		return 0, fmt.Errorf("node %s is not the leader", n.config.NodeID)
	}

	lastIdx := n.wal.LastIndex()
	newIdx := lastIdx + 1

	entry := storage.LogEntry{
		Index:     newIdx,
		Term:      n.term,
		Command:   command,
		Timestamp: time.Now().UnixNano(),
	}

	if err := n.wal.Append([]storage.LogEntry{entry}); err != nil {
		return 0, fmt.Errorf("failed to append log: %w", err)
	}

	return newIdx, nil
}

// startElection triggers leader election round.
func (n *RaftNode) startElection() {
	n.mu.Lock()
	n.role = Candidate
	n.term++
	n.votedFor = n.config.NodeID
	currentTerm := n.term
	lastLogIdx := n.wal.LastIndex()
	lastLogTerm := n.wal.LastTerm()
	n.mu.Unlock()

	votesGranted := 1 // Vote for self
	totalPeers := len(n.config.Peers) + 1
	var voteMu sync.Mutex

	for _, peer := range n.config.Peers {
		go func(p string) {
			ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
			defer cancel()

			args := &transport.RequestVoteArgs{
				Term:         currentTerm,
				CandidateID:  n.config.NodeID,
				LastLogIndex: lastLogIdx,
				LastLogTerm:  lastLogTerm,
			}

			reply, err := n.transport.SendRequestVote(ctx, p, args)
			if err == nil && reply.VoteGranted {
				voteMu.Lock()
				votesGranted++
				if votesGranted > totalPeers/2 {
					n.becomeLeader()
				}
				voteMu.Unlock()
			}
		}(peer)
	}
}

func (n *RaftNode) becomeLeader() {
	n.mu.Lock()
	defer n.mu.Unlock()

	if n.role != Candidate {
		return
	}

	n.role = Leader
	go n.runHeartbeatLoop()
}

func (n *RaftNode) runElectionLoop() {
	for {
		timeout := n.randomElectionTimeout()
		select {
		case <-n.stopChan:
			return
		case <-time.After(timeout):
			n.mu.RLock()
			isFollower := n.role == Follower || n.role == Candidate
			n.mu.RUnlock()

			if isFollower {
				n.startElection()
			}
		}
	}
}

func (n *RaftNode) runHeartbeatLoop() {
	ticker := time.NewTicker(n.config.HeartbeatInterval)
	defer ticker.Stop()

	for {
		select {
		case <-n.stopChan:
			return
		case <-ticker.C:
			n.mu.RLock()
			if n.role != Leader {
				n.mu.RUnlock()
				return
			}
			term := n.term
			commit := n.commitIdx
			n.mu.RUnlock()

			for _, peer := range n.config.Peers {
				go func(p string) {
					ctx, cancel := context.WithTimeout(context.Background(), 40*time.Millisecond)
					defer cancel()

					args := &transport.AppendEntriesArgs{
						Term:         term,
						LeaderID:     n.config.NodeID,
						PrevLogIndex: 0,
						PrevLogTerm:  0,
						Entries:      nil,
						LeaderCommit: commit,
					}
					_, _ = n.transport.SendAppendEntries(ctx, p, args)
				}(peer)
			}
		}
	}
}

func (n *RaftNode) randomElectionTimeout() time.Duration {
	delta := n.config.ElectionTimeoutMax - n.config.ElectionTimeoutMin
	if delta <= 0 {
		return n.config.ElectionTimeoutMin
	}
	jitter := time.Duration(rand.Int63n(int64(delta)))
	return n.config.ElectionTimeoutMin + jitter
}

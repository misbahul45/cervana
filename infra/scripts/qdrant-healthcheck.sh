#!/bin/sh
perl -e 'use IO::Socket::INET; my $s = IO::Socket::INET->new(PeerAddr=>"localhost", PeerPort=>6333, Timeout=>3); exit $s ? 0 : 1'
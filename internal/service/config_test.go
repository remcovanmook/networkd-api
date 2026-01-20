package service

import (
	"strings"
	"testing"
)

func TestNetworkConfig_Validate(t *testing.T) {
	tests := []struct {
		name    string
		config  NetworkConfig
		wantErr bool
		errMsg  string
	}{
		{
			name: "Valid Config",
			config: NetworkConfig{
				Match: MatchSection{Name: []string{"eth0"}},
				Network: NetworkSection{
					Address: []string{"192.168.1.1/24"},
					Gateway: []string{"192.168.1.254"},
					DNS:     []string{"8.8.8.8", "1.1.1.1"},
				},
			},
			wantErr: false,
		},
		{
			name: "Missing Match",
			config: NetworkConfig{
				Match: MatchSection{},
			},
			wantErr: true,
			errMsg:  "Match section must have at least Name, OriginalName, or MACAddress",
		},
		{
			name: "Invalid Address CIDR",
			config: NetworkConfig{
				Match: MatchSection{Name: []string{"eth0"}},
				Network: NetworkSection{
					Address: []string{"192.168.1.1"}, // Missing mask, ParseCIDR requires mask or handled? net.ParseCIDR requires /
				},
			},
			wantErr: true,
			errMsg:  "invalid address CIDR",
		},
		{
			name: "Invalid Gateway IP",
			config: NetworkConfig{
				Match: MatchSection{Name: []string{"eth0"}},
				Network: NetworkSection{
					Gateway: []string{"not-an-ip"},
				},
			},
			wantErr: true,
			errMsg:  "invalid gateway IP",
		},
		{
			name: "Invalid DNS IP",
			config: NetworkConfig{
				Match: MatchSection{Name: []string{"eth0"}},
				Network: NetworkSection{
					DNS: []string{"8.8.8.8", "bad-ip"},
				},
			},
			wantErr: true,
			errMsg:  "invalid DNS IP",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.config.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
			if tt.wantErr && err != nil && !strings.Contains(err.Error(), tt.errMsg) {
				t.Errorf("Validate() error = %v, want error containing %v", err, tt.errMsg)
			}
		})
	}
}

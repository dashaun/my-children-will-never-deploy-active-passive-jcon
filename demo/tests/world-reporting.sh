#!/usr/bin/env bash
# Exercise HTTP failures and incomplete evidence with the presenter's relaxed flags.
set -euo pipefail
source "$(dirname "$0")/../world"
set +euo pipefail
RUN_DIR=$(mktemp -d)
TMPH="$RUN_DIR/headers"
trap 'rm -f "$TMPH" "$RUN_DIR/recovery-region1.id"; rmdir "$RUN_DIR"' EXIT

fail() { echo "FAIL: $*" >&2; exit 1; }
mode=success
curl() {
    case "$mode" in
        failure) return 22 ;;
        incomplete) printf 'HTTP/1.1 201 Created\r\n' > "$TMPH" ;;
        mixed)
            case "$*" in *test-2*) return 22 ;; esac
            printf 'X-Region: region2\r\nX-Latency-Ms: 170\r\n' > "$TMPH" ;;
        *) printf 'X-Region: region1\r\nX-Latency-Ms: 12\r\n' > "$TMPH" ;;
    esac
}
for mode in success failure incomplete mixed; do
    output=$(write_batch test 3 test 2>&1)
    result=$?
    case "$mode" in
        success)
            [[ $result == 0 && "$output" == *'3 succeeded / 3 attempted; 0 failed or unverified'* ]] || fail "$mode: $output" ;;
        mixed)
            [[ $result != 0 && "$output" == *'2 succeeded / 3 attempted; 1 failed or unverified'* ]] || fail "$mode: $output" ;;
        *)
            [[ $result != 0 && "$output" == *'0 succeeded / 3 attempted; 3 failed or unverified'* ]] || fail "$mode: $output"
            [[ "$output" != *'avg latency'* ]] || fail "Failure text treated as a region" ;;
    esac
done
write_batch test 0 >/dev/null 2>&1 && fail 'Accepted zero writes'
# A rejected new proof must not leave a previous proof looking current.
printf 'recovery-aaaa\n' > "$RUN_DIR/recovery-region1.id"
app_ready() { return 0; }
recovery_mark 1 >/dev/null 2>&1 && fail 'Created proof while target healthy'
[[ ! -s "$RUN_DIR/recovery-region1.id" ]] || fail 'Kept stale proof'
recovery_check 1 >/dev/null 2>&1 && fail 'Verified missing proof'
printf 'recovery-aaaa\n' > "$RUN_DIR/recovery-region1.id"
sleep() { :; }
curl() { printf '{"id":"recovery-aaaa","name":"Customer recovery-aaaa","balance":99}'; }
recovery_check 1 >/dev/null 2>&1 && fail 'Verified mismatched account value'
curl() { printf '{"id":"recovery-aaaa","name":"Customer recovery-aaaa","balance":100}'; }
recovery_check 1 >/dev/null 2>&1 || fail 'Rejected exact recovered account'
echo 'PASS: reporting failures, partial batch, invalid count, stale proof, exact recovery value'

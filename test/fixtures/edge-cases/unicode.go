// Package edgecases tests non-ASCII runes and strings.
// 🎯 ✨ 🚀
package edgecases

import "fmt"

type 挨拶 struct {
	メッセージ string
	送信者     string
}

func 新規挨拶(送信者 string, メッセージ string) 挨拶 {
	return 挨拶{
		メッセージ: メッセージ,
		送信者:     送信者,
	}
}

func (a *挨拶) 出力() string {
	return fmt.Sprintf("【%s】: %s 🎉", a.送信者, a.メッセージ)
}

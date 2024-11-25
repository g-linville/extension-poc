package main

import (
	"io"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type Server struct {
	incoming, outgoing chan string
}

func (s Server) connect(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Upgrade error:", err)
		return
	}
	defer conn.Close()

	log.Println("connected")

	for {
		select {
		case message := <-s.incoming:
			err := conn.WriteMessage(websocket.TextMessage, []byte(message))
			if err != nil {
				log.Println("Write error:", err)
			}

			_, out, err := conn.ReadMessage()
			if err != nil {
				log.Println("Read error:", err)
				return
			}

			s.outgoing <- string(out)

		case <-r.Context().Done():
			log.Println("closing connection")
			return
		}
	}
}

func (s Server) send(w http.ResponseWriter, r *http.Request) {
	message, err := io.ReadAll(r.Body)
	if err != nil {
		log.Println("Read error:", err)
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte("Failed to read message"))
		return
	}
	defer r.Body.Close()
	s.incoming <- string(message)

	var out string
	timeout := time.After(10 * time.Second)
	select {
	case out = <-s.outgoing:
	case <-r.Context().Done():
		return
	case <-timeout:
		out = "timed out"
		w.WriteHeader(http.StatusRequestTimeout)
	}
	_, _ = w.Write([]byte(out))
}

func main() {
	server := Server{
		incoming: make(chan string, 100),
		outgoing: make(chan string, 100),
	}
	http.HandleFunc("/connect", server.connect)
	http.HandleFunc("/send", server.send)

	log.Println("Starting WebSocket echo server on :8080")
	err := http.ListenAndServe(":8080", nil)
	if err != nil {
		log.Fatal("ListenAndServe error:", err)
	}
}

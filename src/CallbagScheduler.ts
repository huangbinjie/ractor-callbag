import { AbstractActor, IActorScheduler, Message } from "js-actor"
import { Source, START, DATA, END, Callbag, Sink } from "callbag"
import { CallbagReceive } from "./CallbagReceive"
import { CallbagStore } from "./CallbagStore"
import { System } from "ractor"


export type Signal = START | DATA | END
export type Epic<T = object> = { message: new (...args: any[]) => T, source: Source<T> }

export class CallbagScheduler implements IActorScheduler {
  private handlers: Array<(messageInc: object) => void> = []

  constructor(
    private system: System,
    private event: string,
    private receive: CallbagReceive,
    private owner: CallbagStore<any>
  ) {
    this.receive.listeners.forEach(listener => {
      const epic$ = listener.callback(this.ofMessage(listener.message))
      epic$(0, this.sink$)
    })
  }

  public callback = (messageInc: Object) => {
    try {
      this.handlers.forEach(handler => handler(messageInc))
    } catch (e) {
      this.owner.postError(e)
    }
  }

  public cancel() {
    this.system.eventStream.removeListener(this.event, this.callback)
    return true
  }

  public isCancelled() {
    return !this.system.eventStream.listeners(this.event).length
  }

  public pause() {
    this.cancel()
  }

  public restart() {
    this.cancel()
    this.start()
  }

  public start() {
    this.system.eventStream.addListener(this.event, this.callback)
  }

  public replaceListeners() {

  }

  public ofMessage = (message: Message<object>): Source<object> => (type: Signal, sink: any) => {
    if (type === 0) {
      const handler = (messageInc: object) => {
        if (messageInc instanceof message) {
          sink(1, messageInc)
        }
      }
      this.handlers.push(handler)
      sink(0, (t: Signal, d: any) => {
        if (t === 2) {
          this.handlers.splice(this.handlers.indexOf(handler), 1)
        }
      })
    }
  }

  public sink$ = (t: Signal, d: any) => {
    if (t === 1) {
      this.owner.setState(d)
    }
  }
}
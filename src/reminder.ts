/*
 * @Descripttion: 
 * @version: 0.x
 * @Author: zhai
 * @Date: 2021-04-15 16:14:29
 * @LastEditors: zhai
 * @LastEditTime: 2021-04-15 17:45:23
 */

import * as vscode from 'vscode';
import { singleton } from "tsyringe";
import { ChildProcess } from 'child_process';
import { StatusBarItem } from 'vscode';
import { formatMinutesText } from './extension';


const MAX_IDLE = 5;

@singleton()
export class Reminder {
    private _minutespass: number = 0;
    private _minutes: number = 0;
    private _idle: number = 0;
    private _enable: boolean = false;

    constructor(private _statusItem: StatusBarItem) {

        setInterval(() => {
            // 5分钟内有操作
            if (this._enable && this._idle < MAX_IDLE) {
                this._minutespass += 1;

                this.updateStatusItem();
                
                if (this._minutespass >= this._minutes) {
                    this._minutespass = 0;

                    this.remind();
                }
            }

        }, 1000 * 60);
    }

    set minutes(val: number) {
        this._minutes = val;
        this.updateStatusItem();
    }

    set minutespass(val: number) {
        this._minutespass = val;
        this.updateStatusItem();
    }

    set enable(val: boolean) {
        this._enable = val;
    }

    remindLater(minutes: number = 5) {
        this.minutespass = this._minutes - minutes;
    }

    active() {
        this._idle = 0;
    }

    async remind() {
        const process = await vscode.commands.executeCommand<ChildProcess>('kk.seat.remind');
        console.log("remind process: ", process);
        
        this.minutespass = 0;
    }

    updateStatusItem() {
        this._statusItem.text = formatMinutesText(this._minutespass, this._minutes);
    }
}

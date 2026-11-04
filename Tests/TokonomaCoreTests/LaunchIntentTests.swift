import CoreServices
import Foundation
import Testing
@testable import TokonomaCore

private func openEvent(reason: Int? = nil) -> NSAppleEventDescriptor {
    let event = NSAppleEventDescriptor(
        eventClass: AEEventClass(kCoreEventClass), eventID: AEEventID(kAEOpenApplication),
        targetDescriptor: nil, returnID: AEReturnID(kAutoGenerateReturnID), transactionID: AETransactionID(kAnyTransactionID)
    )
    if let reason {
        event.setParam(NSAppleEventDescriptor(enumCode: OSType(reason)), forKeyword: AEKeyword(keyAEPropData))
    }
    return event
}

@Suite struct LaunchIntentTests {
    private let now = Date(timeIntervalSince1970: 1_000_000)
    private var longAgo: Date { now.addingTimeInterval(-3600) }

    @Test func aPlainOpenIsByHand() {
        #expect(LaunchIntent.openedByHand(openEvent(), now: now, login: longAgo))
        #expect(LaunchIntent.openedByHand(openEvent(), now: now, login: nil))
    }

    @Test func loginAndServiceLaunchesAreNot() {
        #expect(!LaunchIntent.openedByHand(openEvent(reason: Int(LaunchIntent.loginItem)), now: now, login: longAgo))
        #expect(!LaunchIntent.openedByHand(openEvent(reason: Int(LaunchIntent.serviceItem)), now: now, login: longAgo))
    }

    @Test func noEventMeansNobodyClicked() {
        #expect(!LaunchIntent.openedByHand(nil, now: now, login: longAgo))
    }

    @Test func justAfterLoginCountsAsALoginLaunchEvenIfUnmarked() {
        #expect(!LaunchIntent.openedByHand(openEvent(), now: now, login: now.addingTimeInterval(-10)))
    }
}
